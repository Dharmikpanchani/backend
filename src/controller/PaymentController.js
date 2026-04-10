import Razorpay from 'razorpay';
import crypto from 'crypto';
import PaymentTransaction from '../models/PaymentTransaction.js';
import { responseMessage } from '../utils/ResponseMessage.js';
import Logger from '../utils/Logger.js';
import { Buffer } from 'buffer';

const logger = new Logger('./src/controller/PaymentController.js');
// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

let defaultReferralUpiId = process.env.DEFAULTREFL_UPI_ID;
let contactsUrl = process.env.CONTACTS_URL;
let fundAccountsUrl = process.env.FUND_ACCOUNTS;
let payoutsUrl = process.env.PAYOUTS_URL;

//#region Create Order
export const createOrder = async (req, res) => {
  try {
    const {
      amount,
      currency = 'INR',
      schoolId,
      userId,
      planId,
      referralUpiId = defaultReferralUpiId,
    } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: responseMessage.AMOUNT_REQUIRED,
      });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency,
      receipt: `receipt_${Date.now()}`,
    });

    const transaction = await PaymentTransaction.create({
      schoolId,
      userId,
      planId,
      amount,
      totalAmount: amount, // set total Amount
      currency,
      status: 'pending',
      userPaymentStatus: 'pending',
      referralPaymentStatus: referralUpiId ? 'pending' : null,
      adminPaymentStatus: 'pending',
      referralUpiId: referralUpiId || null,
      razorpayOrderId: order.id,
    });

    res.status(201).json({
      success: true,
      data: {
        order,
        transactionId: transaction._id,
      },
    });
  } catch (error) {
    logger.error('Create Order Error:', error);
    res.status(500).json({
      success: false,
      message: responseMessage.ORDER_CREATION_FAILED,
    });
  }
};
//#endregion

//#region Verify Payment
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    await PaymentTransaction.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'authorized',
      }
    );

    res.json({
      success: true,
      message: responseMessage.PAYMENT_VERIFIED,
    });
  } catch (error) {
    logger.error('Verify Payment Error:', error);
    res.status(500).json({ success: false });
  }
};
//#endregion

//#region Webhook
export const razorpayWebhook = async (req, res) => {
  try {
    // ================= VERIFY SIGNATURE =================
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const payloadBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}), 'utf8');

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res
        .status(400)
        .json({ success: false, message: responseMessage.INVALID_SIGNATURE });
    }

    const data = JSON.parse(payloadBody.toString('utf8'));
    const event = data.event;
    const payment = data.payload.payment.entity;

    // ================= FIND TRANSACTION =================
    const transaction = await PaymentTransaction.findOne({
      razorpayOrderId: payment.order_id,
    });

    if (!transaction) {
      return res
        .status(200)
        .json({ status: responseMessage.TRANSACTION_NOT_FOUND });
    }

    // ================= DUPLICATE WEBHOOK PROTECTION =================
    if (event === 'payment.captured' && transaction.status === 'success') {
      return res
        .status(200)
        .json({ status: responseMessage.ALREADY_PROCESSED });
    }

    // ================= PAYMENT SUCCESS =================
    if (event === 'payment.captured') {
      transaction.status = 'success';
      transaction.userPaymentStatus = 'success';
      transaction.transactionId = payment.id;
      transaction.razorpayPaymentId = payment.id;
      transaction.method = payment.method;
      transaction.webhookData = data;

      const amount = transaction.amount;
      transaction.totalAmount = amount;

      // Commission calculation
      let referralAmount = 0;
      let adminAmount = amount;

      if (transaction.referralUpiId) {
        referralAmount = Math.round(amount * 0.3);
        adminAmount = amount - referralAmount;

        transaction.referralAmount = referralAmount;
        transaction.adminAmount = adminAmount;
        transaction.referralPaymentStatus = 'processing';
      } else {
        transaction.adminAmount = amount;
      }

      // Razorpay settlement later
      transaction.adminPaymentStatus = 'settlement_pending';

      // Subscription start/end (30 days example)
      const days = 30;
      transaction.startDate = new Date();
      transaction.endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await transaction.save();

      // ================= REFERRAL PAYOUT =================
      if (
        transaction.referralUpiId &&
        transaction.referralPaymentStatus !== 'sent'
      ) {
        try {
          const authHeader =
            'Basic ' +
            Buffer.from(
              `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
            ).toString('base64');

          const headers = {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          };

          // Create Contact
          const contactRes = await fetch(contactsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: 'Referral User',
              type: 'employee',
            }),
          });
          const contactData = await contactRes.json();
          if (contactData.error) throw new Error(contactData.error.description);

          // Create Fund Account
          const fundRes = await fetch(fundAccountsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              contact_id: contactData.id,
              account_type: 'vpa',
              vpa: {
                address: transaction.referralUpiId,
              },
            }),
          });
          const fundData = await fundRes.json();
          if (fundData.error) throw new Error(fundData.error.description);

          // Create Payout
          const payoutRes = await fetch(payoutsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
              fund_account_id: fundData.id,
              amount: referralAmount * 100,
              currency: 'INR',
              mode: 'UPI',
              purpose: 'commission',
            }),
          });
          const payoutData = await payoutRes.json();
          if (payoutData.error) throw new Error(payoutData.error.description);

          transaction.referralPaymentStatus = 'sent';
          transaction.referralPayoutId = payoutData.id;
        } catch (error) {
          logger.error('Referral payout failed:', error.message);
          transaction.referralPaymentStatus = 'failed';
        }

        await transaction.save();
      }
    }

    // ================= PAYMENT FAILED =================
    if (event === 'payment.failed') {
      transaction.status = 'failed';
      transaction.userPaymentStatus = 'failed';
      transaction.adminPaymentStatus = 'failed';

      if (transaction.referralUpiId) {
        transaction.referralPaymentStatus = 'failed';
      }

      transaction.errorMessage = payment.error_description;
      transaction.webhookData = data;
      await transaction.save();
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook Error:', error);
    res.status(500).json({ success: false });
  }
};
//#endregion

//#region Get Transactions
export const getTransactions = async (req, res) => {
  try {
    const { status, schoolId, userId } = req.query;

    let filter = {};

    if (status) filter.status = status;
    if (schoolId) filter.schoolId = schoolId;
    if (userId) filter.userId = userId;

    const transactions = await PaymentTransaction.find(filter).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    logger.error('Failed to fetch transactions:', error);
    res.status(500).json({
      success: false,
      message: responseMessage.FAILED_TO_FETCH_TRANSACTION,
    });
  }
};
//#endregion

import Razorpay from 'razorpay';
import crypto from 'crypto';
import PaymentTransaction from '../models/PaymentTransaction.js';
import School from '../models/school/School.js';
import Teacher from '../models/teacher/Teacher.js';
import Admin from '../models/common/Admin.js';
import Payout from '../models/Payout.js';
import Plan from '../models/common/Plan.js';
import {
  ResponseHandler,
  CatchErrorHandler,
} from '../services/CommonServices.js';
import { StatusCodes } from 'http-status-codes';
import { responseMessage } from '../utils/ResponseMessage.js';
import Logger from '../utils/Logger.js';
import { Buffer } from 'buffer';

const logger = new Logger('./src/controller/PaymentController.js');
// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

let payoutsUrl = process.env.PAYOUTS_URL;

//#region Create School Plan Order
export const createSchoolPlan = async (req, res) => {
  try {
    const {
      // amount: _clientAmount, // Removed to avoid lint error
      currency = 'INR',
      schoolId: initialSchoolId,
      schoolCode,
      userId: initialUserId,
      planId,
      billingCycle = 'yearly',
      type = 'SUBSCRIPTION', // SUBSCRIPTION | FEES
    } = req.body;

    let schoolId = initialSchoolId || req.school_id;
    let userId = initialUserId || req.admin_id;

    // 1. Resolve School if only schoolCode is provided
    if (!schoolId && schoolCode) {
      const school = await School.findOne({ schoolCode, isDeleted: false });
      if (!school) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SCHOOL_NOT_FOUND
        );
      }
      schoolId = school._id;
    }

    if (!schoolId) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        'School ID or School Code is required'
      );
    }

    // 2. Resolve Plan and Calculate Amount
    const plan = await Plan.findById(planId);
    if (!plan) {
      return ResponseHandler(res, StatusCodes.NOT_FOUND, 'Plan not found');
    }

    const amount = billingCycle === 'monthly' ? plan.monPrice : plan.yerPrice;

    if (!amount || amount <= 0) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        'Invalid plan price'
      );
    }

    // Fetch school to get referral details if subscription
    let referralId = null;
    let referralUpiId = null;
    const school = await School.findById(schoolId).populate('referralId');
    if (school && school.referralId) {
      referralId = school.referralId._id;
      referralUpiId = school.referralId.UPIId;
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `receipt_${Date.now()}`,
    });

    const transaction = await PaymentTransaction.create({
      schoolId,
      userId,
      planId,
      amount,
      totalAmount: amount,
      currency,
      status: 'pending',
      type,
      referralId,
      referralUpiId,
      razorpayOrderId: order.id,
      userPaymentStatus: 'pending',
      referralPaymentStatus: referralId ? 'pending' : null,
      adminPaymentStatus: 'pending',
    });

    return ResponseHandler(res, StatusCodes.CREATED, responseMessage.SUCCESS, {
      order,
      transactionId: transaction._id,
    });
  } catch (error) {
    logger.error('Create Order Error:', error);
    return CatchErrorHandler(res, error, responseMessage.ORDER_CREATION_FAILED);
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
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PAYMENT_SIGNATURE_INVALID
      );
    }

    await PaymentTransaction.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'authorized',
      }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PAYMENT_VERIFIED
    );
  } catch (error) {
    logger.error('Verify Payment Error:', error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Webhook
export const razorpayWebhook = async (req, res) => {
  try {
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
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_SIGNATURE
      );
    }

    const data = JSON.parse(payloadBody.toString('utf8'));
    const event = data.event;
    const payment = data.payload.payment.entity;

    const transaction = await PaymentTransaction.findOne({
      razorpayOrderId: payment.order_id,
    });

    if (!transaction) {
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.TRANSACTION_NOT_FOUND
      );
    }

    if (event === 'payment.captured' && transaction.status === 'success') {
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ALREADY_PROCESSED
      );
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      transaction.status = 'success';
      transaction.userPaymentStatus = 'success';
      transaction.transactionId = payment.id;
      transaction.razorpayPaymentId = payment.id;
      transaction.method = payment.method;
      transaction.webhookData = data;

      const amount = transaction.amount;
      transaction.totalAmount = amount;

      // ================= COMMISSION LOGIC (20% to Referral) =================
      // Only apply 20/80 split if referralId exists AND they have a UPI ID set
      if (
        transaction.type === 'SUBSCRIPTION' &&
        transaction.referralId &&
        transaction.referralUpiId
      ) {
        const referralCommission = Math.round(amount * 0.2); // 20% commission
        const platformRevenue = amount - referralCommission;

        transaction.commissionAmount = referralCommission;
        transaction.adminAmount = platformRevenue;
        transaction.referralAmount = referralCommission;
        transaction.referralPaymentStatus = 'processing';

        // Fetch referral name from Admin record
        let referralName = 'Referral Developer';
        const referralAdmin = await Admin.findById(transaction.referralId);
        if (referralAdmin) {
          referralName = referralAdmin.name || referralName;
        }

        // Trigger Payout for Referral
        try {
          await triggerPayout({
            transactionId: transaction._id,
            receiverType: 'REFERRAL',
            receiverId: transaction.referralId,
            upiId: transaction.referralUpiId,
            amount: referralCommission,
            name: referralName,
          });
        } catch (payoutError) {
          logger.error(
            'Referral payout failed during webhook:',
            payoutError.message
          );
          // status is already updated in triggerPayout's catch block for the Payout record
        }
      } else {
        // No referral or no UPI ID provided for referral -> 100% to admin/super-developer
        transaction.adminAmount = amount;
        transaction.commissionAmount = 0;
        transaction.referralAmount = 0;
        if (transaction.referralId) {
          transaction.referralPaymentStatus = 'failed';
        }
      }

      // ================= FEES PAYMENT LOGIC =================
      if (transaction.type === 'FEES') {
        // Platform collects full amount, to be settled to school later
        // Optionally trigger payout to school here or manually
        transaction.adminPaymentStatus = 'received';
      }

      // ================= UPDATE SCHOOL PLAN LOGIC =================
      if (
        transaction.type === 'SUBSCRIPTION' &&
        transaction.planId &&
        transaction.schoolId
      ) {
        try {
          const plan = await Plan.findById(transaction.planId);
          if (plan) {
            const school = await School.findById(transaction.schoolId);
            if (school) {
              const currentDate = new Date();
              // If school already has an active plan that hasn't expired yet, extend from that date
              // Otherwise, start from current date
              let baseDate = currentDate;
              if (
                school.PlanExptyDate &&
                school.PlanExptyDate > currentDate.getTime()
              ) {
                baseDate = new Date(school.PlanExptyDate);
              }

              let newExpiryDate = new Date(baseDate);
              if (plan.billingCycle === 'monthly') {
                newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
              } else if (plan.billingCycle === 'yearly') {
                newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
              }

              school.plan = {
                planName: plan.planName,
                monPrice: plan.monPrice,
                monOfferPrice: plan.monOfferPrice,
                yerPrice: plan.yerPrice,
                yerOfferPrice: plan.yerOfferPrice,
                billingCycle: plan.billingCycle,
                permissions: plan.permissions,
              };
              school.PlanExptyDate = newExpiryDate.getTime();
              school.isActivePlan = true;
              await school.save();

              logger.info(
                `Updated school ${school.schoolName} plan to ${plan.planName}. New expiry: ${newExpiryDate}`
              );
            }
          }
        } catch (planError) {
          logger.error(
            'Failed to update school plan after payment:',
            planError
          );
        }
      }

      await transaction.save();
    }

    if (event === 'payment.failed') {
      transaction.status = 'failed';
      transaction.userPaymentStatus = 'failed';
      transaction.adminPaymentStatus = 'failed';
      if (transaction.referralId) transaction.referralPaymentStatus = 'failed';
      transaction.errorMessage = payment.error_description;
      transaction.webhookData = data;
      await transaction.save();
    }

    return ResponseHandler(res, StatusCodes.OK, 'Webhook received');
  } catch (error) {
    logger.error('Webhook Error:', error);
    return CatchErrorHandler(res, error);
  }
};

// Internal Helper function to trigger Razorpay Payouts
const triggerPayout = async ({
  transactionId,
  receiverType,
  receiverId,
  upiId,
  amount,
  name = 'User',
}) => {
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

    // Create a record in Payouts table
    const payoutRecord = await Payout.create({
      transactionId,
      receiverType,
      receiverId,
      upiId,
      amount,
      status: 'pending',
    });

    // ================= COMPOSITE PAYOUT (Single API Call) =================
    // This flow combines Contact + Fund Account + Payout creation
    const payoutPayload = {
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      amount: Math.round(amount * 100), // in paise
      currency: 'INR',
      mode: 'UPI',
      purpose: receiverType === 'REFERRAL' ? 'commission' : 'salary',
      fund_account: {
        account_type: 'vpa',
        vpa: { address: upiId },
        contact: {
          name: name || receiverType + ' User',
          type: receiverType === 'REFERRAL' ? 'customer' : 'employee',
          reference_id: receiverId ? receiverId.toString() : null,
        },
      },
      queue_if_low_balance: true,
    };

    const payoutRes = await fetch(payoutsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payoutPayload),
    });

    const payoutData = await payoutRes.json();
    if (payoutData.error) {
      throw new Error(payoutData.error.description || 'Payout failed');
    }

    // Update Payout Record
    payoutRecord.razorpayPayoutId = payoutData.id;
    payoutRecord.status = payoutData.status; // e.g., 'queued', 'pending', 'processing'
    await payoutRecord.save();

    // Update Transaction if referral
    if (receiverType === 'REFERRAL' && transactionId) {
      await PaymentTransaction.findByIdAndUpdate(transactionId, {
        referralPaymentStatus: 'sent',
        referralPayoutId: payoutData.id,
      });
    }

    return payoutData;
  } catch (error) {
    logger.error(`${receiverType} payout failed:`, error.message);
    if (transactionId && receiverType === 'REFERRAL') {
      await PaymentTransaction.findByIdAndUpdate(transactionId, {
        referralPaymentStatus: 'failed',
      });
    }
    // Update Payout Record as failed
    await Payout.findOneAndUpdate(
      { transactionId, receiverType, status: 'pending' },
      { status: 'failed', errorMessage: error.message }
    );
    throw error;
  }
};

//#region Teacher Salary Payout
export const payTeacherSalary = async (req, res) => {
  try {
    const { teacherId, amount, upiId } = req.body;

    if (!teacherId || !amount || !upiId) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        'Teacher ID, Amount, and UPI ID are required'
      );
    }

    // Fetch teacher name
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return ResponseHandler(res, StatusCodes.NOT_FOUND, 'Teacher not found');
    }

    // Trigger direct payout
    const payoutData = await triggerPayout({
      transactionId: null,
      receiverType: 'TEACHER',
      receiverId: teacherId,
      upiId: upiId,
      amount: amount,
      name: teacher.fullName,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      'Salary payout initiated',
      payoutData
    );
  } catch (error) {
    logger.error('Salary Payout Error:', error);
    return CatchErrorHandler(res, error, 'Failed to initiate salary payout');
  }
};
//#endregion
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

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TRANSACTION_FETCH_SUCCESS,
      {
        count: transactions.length,
        data: transactions,
      }
    );
  } catch (error) {
    logger.error('Failed to fetch transactions:', error);
    return CatchErrorHandler(
      res,
      error,
      responseMessage.FAILED_TO_FETCH_TRANSACTION
    );
  }
};
//#endregion

import mongoose from 'mongoose';

const PaymentTransactionSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },

    // ================= AMOUNTS =================
    amount: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    referralAmount: {
      type: Number,
      default: 0,
    },
    adminAmount: {
      type: Number,
      default: 0,
    },

    // ================= PAYMENT STATUS =================
    userPaymentStatus: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    referralPaymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
    },
    adminPaymentStatus: {
      type: String,
      enum: ['pending', 'received', 'settlement_pending', 'failed'],
      default: 'pending',
    },

    // ================= REFERRAL =================
    referralUpiId: {
      type: String,
      default: null,
    },
    referralPayoutId: {
      type: String,
      default: null,
    },

    // ================= TRANSACTION =================
    transactionId: {
      type: String,
      default: null,
    },
    currency: {
      type: String,
      default: 'INR',
    },

    status: {
      type: String,
      enum: [
        'pending', // order created
        'authorized', // payment done but not captured
        'success', // payment captured
        'failed', // payment failed
        'refunded', // refund done
      ],
      default: 'pending',
    },

    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },

    method: {
      type: String,
      default: null, // upi, card, netbanking, wallet
    },

    // ================= SUBSCRIPTION =================
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },

    // ================= ERROR =================
    errorMessage: {
      type: String,
      default: null,
    },

    // ================= WEBHOOK LOG =================
    webhookData: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

const PaymentTransaction = mongoose.model(
  'PaymentTransaction',
  PaymentTransactionSchema
);

export default PaymentTransaction;

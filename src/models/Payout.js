import mongoose from 'mongoose';

const PayoutSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
      default: null,
    },
    receiverType: {
      type: String,
      enum: ['REFERRAL', 'TEACHER', 'SCHOOL'],
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    upiId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'queued',
        'processing',
        'processed',
        'reversed',
        'cancelled',
        'rejected',
        'failed',
      ],
      default: 'pending',
    },
    razorpayPayoutId: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Payout = mongoose.model('Payout', PayoutSchema);

export default Payout;

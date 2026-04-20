import mongoose from 'mongoose';

const PlanSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    monPrice: {
      type: Number,
      default: 0,
    },
    monOfferPrice: {
      type: Number,
      default: 0,
    },
    yerPrice: {
      type: Number,
      default: 0,
    },
    yerOfferPrice: {
      type: Number,
      default: 0,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
    },
    permissions: [
      {
        type: String,
      },
    ],
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Plan = mongoose.model('Plan', PlanSchema);
export default Plan;

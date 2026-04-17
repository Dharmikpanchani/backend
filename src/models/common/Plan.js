import mongoose from 'mongoose';

const PlanSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
    },
    maxStudents: {
      type: Number,
      required: true,
    },
    maxTeachers: {
      type: Number,
      required: true,
    },
    maxClasses: {
      type: Number,
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

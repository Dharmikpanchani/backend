import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    phoneNumber: String,

    name: String,

    image: {
      type: String,
      default: null,
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoleManagement',
    },

    // 🔥 MAIN DIFFERENTIATOR
    type: {
      type: String,
      enum: ['super_developer', 'developer', 'school_admin'],
      required: true,
    },

    // 🔥 ONLY FOR SCHOOL ADMIN
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
    },

    otp: Number,
    otpExpireAt: Date,

    isActive: {
      type: Boolean,
      default: true,
    },

    isLogin: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    address: String,

    isReferralAdmin: {
      type: Boolean,
      default: false,
    },

    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔥 Unique per type
AdminSchema.index({ email: 1, schoolId: 1 }, { unique: true });

const Admin = mongoose.model('Admin', AdminSchema);
export default Admin;

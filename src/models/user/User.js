import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
    },
    phoneNumber: {
      type: String,
      required: false,
    },
    otp: {
      type: Number,
      default: null,
    },
    otpExpireAt: {
      type: Date,
      default: null,
    },
    // Multi-tenant fields
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true, // Optional if users can exist without a school, but typically required in SAAS.
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    userType: {
      type: String,
      enum: ['student', 'teacher'],
      required: false,
    },
  },
  { timestamps: true }
);
const User = mongoose.model('User', UserSchema);
export default User;

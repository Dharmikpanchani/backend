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
    // Multi-tenant fields
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true, // Optional if users can exist without a school, but typically required in SAAS.
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: false,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false,
    },
    userType: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      required: true,
    },
    attendanceId: {
      type: String,
      default: null,
    },
    otp: {
      type: Number,
      default: null,
    },
    otpExpireAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);
const User = mongoose.model('User', UserSchema);
export default User;

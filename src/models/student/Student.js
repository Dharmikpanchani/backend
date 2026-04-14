import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    dateOfBirth: {
      type: Date,
    },
    profileImage: {
      type: String,
      default: null,
    },
    bloodGroup: {
      type: String,
    },

    // 🔹 2. Contact Details
    email: {
      type: String,
      required: false, // Students might not have email
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    country: {
      type: String,
    },
    pincode: {
      type: String,
    },

    // 🔹 3. Authentication & Login
    password: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isLogin: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },

    // 🔹 4. Academic Details
    admissionNumber: {
      type: String,
      required: true,
    },
    admissionDate: {
      type: Date,
    },
    rollNumber: {
      type: String,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },

    // 🔹 5. Guardian Details
    fatherName: String,
    fatherPhone: String,
    motherName: String,
    motherPhone: String,
    guardianName: String,
    guardianPhone: String,

    // 🔹 6. System Fields
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique admission number within a school
StudentSchema.index({ admissionNumber: 1, schoolId: 1 }, { unique: true });

const Student = mongoose.model('Student', StudentSchema);
export default Student;

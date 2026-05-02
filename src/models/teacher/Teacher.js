import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema(
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
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    alternatePhoneNumber: {
      type: String,
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

    // 🔹 4. Professional Details
    joiningDate: {
      type: Date,
    },
    experienceYears: {
      type: Number,
    },
    qualification: {
      type: String,
    },
    specialization: {
      type: String,
    },
    designation: {
      type: String,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    classesAssigned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
      },
    ],
    sectionsAssigned: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Section',
      },
    ],

    // 🔹 5. Salary & Employment
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract'],
    },
    salary: {
      type: Number,
    },
    salaryType: {
      type: String,
      enum: ['Monthly', 'Hourly'],
    },
    bankName: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    ifscCode: {
      type: String,
    },
    panNumber: {
      type: String,
    },
    aadharNumber: {
      type: String,
    },

    // 🔹 6. Documents
    resume: {
      type: String,
    },
    idProof: {
      type: String,
    },
    educationCertificates: [
      {
        type: String,
      },
    ],
    experienceCertificates: [
      {
        type: String,
      },
    ],

    // 🔹 7. Attendance & Tracking
    attendanceId: {
      type: String,
    },
    leaveBalance: {
      type: Number,
      default: 0,
    },
    workingHours: {
      type: String,
    },
    shiftTiming: {
      type: String,
    },

    // 🔹 8. System Fields
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
  },
  { timestamps: true }
);

const Teacher = mongoose.model('Teacher', TeacherSchema);
export default Teacher;

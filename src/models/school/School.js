import mongoose from 'mongoose';

const SchoolSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
    },
    zipCode: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    board: {
      type: String,
      enum: ['CBSE', 'GSEB', 'ICSE', 'IB', 'State Board', 'IGCSE', 'Other'],
      required: true,
    },
    schoolType: {
      type: String,
      enum: [
        'Primary',
        'Secondary',
        'Higher Secondary',
        'Junior College',
        'Other',
      ],
      required: true,
    },
    medium: {
      type: String,
      enum: ['English', 'Gujarati', 'Hindi', 'Other'],
      default: 'English',
    },
    establishedYear: {
      type: Date,
      default: null,
    },
    registrationNumber: {
      type: String,
      default: '',
    },
    gstNumber: {
      type: String,
      default: '',
    },
    panNumber: {
      type: String,
      default: '',
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    banner: {
      type: String,
      default: '',
    },
    affiliationCertificate: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      required: true,
    },
    schoolCode: {
      type: String,
      unique: true,
    },
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
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

// Pre-save hook to generate unique school code if not present
SchoolSchema.pre('save', async function (next) {
  if (!this.schoolCode) {
    const code =
      this.schoolName.substring(0, 3).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase();
    this.schoolCode = code;
  }
  next();
});

const School = mongoose.model('School', SchoolSchema);
export default School;

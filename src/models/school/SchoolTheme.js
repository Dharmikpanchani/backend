import mongoose from 'mongoose';

const SchoolThemeSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      unique: true,
    },
    borderRadius: { type: String },
    layoutStyle: { type: String },
    sidebarStyle: { type: String },
    fontFamily: { type: String },
    fontSize: { type: String },
    tableStyle: { type: String },
    cardShadow: { type: String },
    buttonBg: { type: String },
    buttonText: { type: String },
    buttonRadius: { type: String },
    buttonBorder: { type: String },
    buttonHoverBg: { type: String },
    textPrimary: { type: String },
    textSecondary: { type: String },
    textMuted: { type: String },
    linkColor: { type: String },
    headingColor: { type: String },
    sidebarBg: { type: String },
    sidebarText: { type: String },
    sidebarActiveBg: { type: String },
    sidebarActiveText: { type: String },
    headerBg: { type: String },
    headerText: { type: String },
    pageBg: { type: String },
    cardBg: { type: String },
    cardBorder: { type: String },
    inputBg: { type: String },
    inputBorder: { type: String },
    tableHeaderBg: { type: String },
    tableRowHover: { type: String },
    primaryColor: { type: String },
    secondaryColor: { type: String },
    successColor: { type: String },
    errorColor: { type: String },
    warningColor: { type: String },
    infoColor: { type: String },
  },
  { timestamps: true, strict: false }
);

const SchoolTheme = mongoose.model('SchoolTheme', SchoolThemeSchema);
export default SchoolTheme;

import { StatusCodes } from 'http-status-codes';
import Teacher from '../../../models/teacher/Teacher.js';
import User from '../../../models/user/User.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  queryBuilder,
  encryptPassword,
} from '../../../services/CommonServices.js';
import Logger from '../../../utils/Logger.js';
import { responseMessage } from '../../../utils/ResponseMessage.js';
import * as OtpService from '../../../services/OtpService.js';
import * as SmsService from '../../../services/SmsService.js';

const logger = new Logger(
  './src/controller/schoolAdmin/teacher/TeacherController.js'
);
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const createTeacher = async (req, res) => {
  try {
    const {
      fullName,
      gender,
      dateOfBirth,
      profileImage,
      bloodGroup,
      email,
      phoneNumber,
      alternatePhoneNumber,
      address,
      city,
      state,
      country,
      pincode,
      password,
      joiningDate,
      experienceYears,
      qualification,
      specialization,
      designation,
      departmentId,
      subjects,
      classesAssigned,
      sectionsAssigned,
      employmentType,
      salary,
      salaryType,
      bankName,
      accountNumber,
      ifscCode,
      panNumber,
      aadharNumber,
      resume,
      idProof,
      educationCertificates,
      experienceCertificates,
      attendanceId,
      leaveBalance,
      workingHours,
      shiftTiming,
    } = req.body;
    const schoolId = req.school_id;
    const createdBy = req.admin_id;

    // 🔥 Validation: IFSC Code
    if (ifscCode && !ifscRegex.test(ifscCode)) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_IFSC_CODE_FORMAT
      );
    }

    // 🔥 Uniqueness check in central User model
    const existingUser = await User.findOne({
      $or: [
        { email },
        { phoneNumber },
        ...(attendanceId ? [{ attendanceId }] : []),
      ],
      schoolId,
    });

    if (existingUser) {
      const message =
        attendanceId && existingUser.attendanceId === attendanceId
          ? responseMessage.ATTENDANCE_ID_ALREADY_EXISTS
          : responseMessage.TEACHER_ALREADY_EXISTS;

      return ResponseHandler(res, StatusCodes.CONFLICT, message);
    }

    // 1. Encrypt Password
    const hashedPassword = await encryptPassword(password || 'Teacher@123');

    // 2. Create Teacher profile
    const newTeacher = await Teacher.create({
      fullName,
      gender,
      dateOfBirth,
      profileImage,
      bloodGroup,
      email,
      phoneNumber,
      alternatePhoneNumber,
      address,
      city,
      state,
      country,
      pincode,
      password: hashedPassword,
      joiningDate,
      experienceYears,
      qualification,
      specialization,
      designation,
      departmentId,
      subjects,
      classesAssigned,
      sectionsAssigned,
      employmentType,
      salary,
      salaryType,
      bankName,
      accountNumber,
      ifscCode,
      panNumber,
      aadharNumber,
      resume,
      idProof,
      educationCertificates,
      experienceCertificates,
      attendanceId,
      leaveBalance,
      workingHours,
      shiftTiming,
      schoolId,
      createdBy,
      isActive: false,
      isVerified: false,
    });

    // 3. Create User identity
    const newUser = await User.create({
      email,
      phoneNumber,
      schoolId,
      teacherId: newTeacher._id,
      userType: 'teacher',
      attendanceId,
      isActive: false,
      isVerified: false,
    });

    // Sync linkage
    newTeacher.userId = newUser._id;
    await newTeacher.save();

    // 4. Handle OTP
    const otp = OtpService.generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Save OTP to Teacher and User for redundancy/auth
    newTeacher.otp = otp;
    newTeacher.otpExpiry = otpExpiry;
    await newTeacher.save();

    newUser.otp = otp;
    newUser.otpExpireAt = otpExpiry;
    await newUser.save();

    await SmsService.sendSms(phoneNumber, `Your verification code: ${otp}`);

    return ResponseHandler(
      res,
      StatusCodes.CREATED,
      responseMessage.TEACHER_ADDED,
      newTeacher
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const getTeachers = async (req, res) => {
  try {
    const {
      departmentId,
      classId,
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      type,
    } = req.query;

    const filters = {
      ...req.schoolFilter,
      isActive: type ? true : isActive,
    };

    if (departmentId) filters.departmentId = departmentId;
    if (classId) filters.classesAssigned = classId;

    const result = await queryBuilder(Teacher, {
      pageNumber,
      perPageData,
      searchRequest,
      searchableFields: ['fullName', 'email', 'phoneNumber', 'designation'],
      filters,
      populate: [
        { path: 'departmentId', select: 'name' },
        { path: 'classesAssigned', select: 'name' },
        { path: 'sectionsAssigned', select: 'code' },
        { path: 'subjects', select: 'name' },
        { path: 'userId', select: 'otp otpExpireAt' },
      ],
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TEACHER_FETCH_SUCCESS,
      result
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      gender,
      dateOfBirth,
      profileImage,
      bloodGroup,
      email,
      phoneNumber,
      alternatePhoneNumber,
      address,
      city,
      state,
      country,
      pincode,
      joiningDate,
      experienceYears,
      qualification,
      specialization,
      designation,
      departmentId,
      subjects,
      classesAssigned,
      sectionsAssigned,
      employmentType,
      salary,
      salaryType,
      bankName,
      accountNumber,
      ifscCode,
      panNumber,
      aadharNumber,
      resume,
      idProof,
      educationCertificates,
      experienceCertificates,
      attendanceId,
      leaveBalance,
      workingHours,
      shiftTiming,
    } = req.body;
    const schoolId = req.school_id;
    const updatedBy = req.admin_id;

    // 🔥 Validation: IFSC Code
    if (ifscCode && !ifscRegex.test(ifscCode)) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_IFSC_CODE_FORMAT
      );
    }

    const teacher = await Teacher.findOne({ _id: id, schoolId });
    if (!teacher) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.TEACHER_NOT_FOUND
      );
    }

    // 🔥 Uniqueness check in central User model (excluding self)
    const existingUser = await User.findOne({
      $or: [
        { email },
        { phoneNumber },
        ...(attendanceId ? [{ attendanceId }] : []),
      ],
      schoolId,
      teacherId: { $ne: id },
    });

    if (existingUser) {
      const message =
        attendanceId && existingUser.attendanceId === attendanceId
          ? responseMessage.ATTENDANCE_ID_ALREADY_EXISTS
          : responseMessage.ANOTHER_TEACHER_ALREADY_EXISTS;

      return ResponseHandler(res, StatusCodes.CONFLICT, message);
    }

    // 1. Update User identity
    await User.findOneAndUpdate(
      { teacherId: id },
      {
        email,
        phoneNumber,
        attendanceId,
      }
    );

    // 2. Update Teacher profile
    const updatedTeacher = await Teacher.findOneAndUpdate(
      { _id: id, schoolId },
      {
        fullName,
        gender,
        dateOfBirth,
        profileImage,
        bloodGroup,
        email,
        phoneNumber,
        alternatePhoneNumber,
        address,
        city,
        state,
        country,
        pincode,
        joiningDate,
        experienceYears,
        qualification,
        specialization,
        designation,
        departmentId,
        subjects,
        classesAssigned,
        sectionsAssigned,
        employmentType,
        salary,
        salaryType,
        bankName,
        accountNumber,
        ifscCode,
        panNumber,
        aadharNumber,
        resume,
        idProof,
        educationCertificates,
        experienceCertificates,
        attendanceId,
        leaveBalance,
        workingHours,
        shiftTiming,
        updatedBy,
      },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TEACHER_UPDATED,
      updatedTeacher
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.school_id;

    const teacher = await Teacher.findOne({ _id: id, schoolId });
    if (!teacher) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.TEACHER_NOT_FOUND
      );
    }

    // 1. Soft delete User identity
    await User.findOneAndUpdate({ teacherId: id }, { isDeleted: true });

    // 2. Soft delete Teacher profile
    await Teacher.findOneAndUpdate({ _id: id, schoolId }, { isDeleted: true });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TEACHER_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const verifyTeacherOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const schoolId = req.school_id;

    // Check in Teacher model for OTP
    const teacher = await Teacher.findOne({
      phoneNumber: phone,
      schoolId,
      isDeleted: false,
    });

    if (!teacher) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.TEACHER_NOT_FOUND
      );
    }

    // Basic OTP verification (In standard production, use OtpService)
    if (teacher.otp !== otp || new Date() > teacher.otpExpiry) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OTP
      );
    }

    // Update Teacher
    teacher.isVerified = true;
    teacher.isActive = true;
    teacher.otp = null;
    teacher.otpExpiry = null;
    await teacher.save();

    // Update Sync User
    await User.findOneAndUpdate(
      { teacherId: teacher._id },
      { isVerified: true, isActive: true, otp: null, otpExpireAt: null }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TEACHER_VERIFIED
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

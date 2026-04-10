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

export const createTeacher = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      gender,
      address,
      schoolEmail,
      departmentId,
      classIds,
      sectionId,
      subjectIds,
    } = req.body;
    const schoolId = req.school_id;

    // 🔥 Uniqueness check in central User model
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber: phone }],
      schoolId,
    });

    if (existingUser) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.TEACHER_ALREADY_EXISTS
      );
    }

    // 1. Encrypt Password
    const hashedPassword = await encryptPassword(password || 'Teacher@123');

    // 2. Create Teacher profile (Identity fields migrated here)
    const newTeacher = await Teacher.create({
      name: `${firstName} ${lastName}`,
      email,
      phoneNumber: phone,
      password: hashedPassword,
      gender,
      address,
      schoolEmail,
      departmentId,
      classIds,
      sectionId,
      subjectIds,
      schoolId,
      isActive: false,
      isVerify: false,
    });

    // 3. Create User identity (Minimal for OTP/Sync)
    const newUser = await User.create({
      email,
      phoneNumber: phone,
      schoolId,
      teacherId: newTeacher._id,
      userType: 'teacher',
    });

    // Sync linkage
    newTeacher.userId = newUser._id;
    await newTeacher.save();

    // 4. Handle OTP
    const otp = OtpService.generateOtp();
    await OtpService.storeOtp('teacher_verification', phone, otp);
    await SmsService.sendSms(phone, `Your verification code: ${otp}`);

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
    if (classId) filters.classIds = classId;

    const result = await queryBuilder(Teacher, {
      pageNumber,
      perPageData,
      searchRequest,
      searchableFields: ['name', 'email', 'phoneNumber'],
      filters,
      populate: [
        { path: 'departmentId', select: 'name' },
        { path: 'classIds', select: 'name' },
        { path: 'sectionId', select: 'name' },
        { path: 'subjectIds', select: 'name' },
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
      firstName,
      lastName,
      email,
      phone,
      gender,
      address,
      schoolEmail,
      departmentId,
      classIds,
      sectionId,
      subjectIds,
    } = req.body;
    const schoolId = req.school_id;

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
      $or: [{ email }, { phoneNumber: phone }],
      schoolId,
      teacherId: { $ne: id },
    });

    if (existingUser) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.ANOTHER_TEACHER_ALREADY_EXISTS
      );
    }

    // 1. Update User identity
    await User.findOneAndUpdate(
      { teacherId: id },
      {
        email,
        phoneNumber: phone,
      }
    );

    // 2. Update Teacher profile
    const updatedTeacher = await Teacher.findOneAndUpdate(
      { _id: id, schoolId },
      {
        name: `${firstName} ${lastName}`,
        email,
        phoneNumber: phone,
        gender,
        address,
        schoolEmail,
        departmentId,
        classIds,
        sectionId,
        subjectIds,
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

    const verification = await OtpService.verifyOtp(
      'teacher_verification',
      phone,
      otp
    );

    if (!verification.success) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        verification.message
      );
    }

    // Update Teacher (Not User) as identity moved to Teacher
    const teacher = await Teacher.findOneAndUpdate(
      { phoneNumber: phone, schoolId, isDeleted: false },
      { isVerify: true, isActive: true },
      { new: true }
    );

    if (!teacher) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.TEACHER_NOT_FOUND
      );
    }

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

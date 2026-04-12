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

export const addEditTeacher = async (req, res) => {
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
    const adminId = req.admin_id;

    // ✅ Handle Files from MediaUpload middleware
    const finalProfileImage = req.profileImage || profileImage;
    const finalResume = req.resume || resume;
    const finalIdProof = req.idProof || idProof;
    const finalEducationCertificates =
      req.educationCertificates?.length > 0
        ? req.educationCertificates
        : Array.isArray(educationCertificates)
          ? educationCertificates
          : educationCertificates
            ? [educationCertificates]
            : [];
    const finalExperienceCertificates =
      req.experienceCertificates?.length > 0
        ? req.experienceCertificates
        : Array.isArray(experienceCertificates)
          ? experienceCertificates
          : experienceCertificates
            ? [experienceCertificates]
            : [];

    // ✅ Normalize Array Fields
    const normalizeArray = (val, altKey) => {
      const data = val || req.body[altKey];
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [data];
      }
    };

    const finalSubjects = normalizeArray(subjects, 'subjects[]');
    const finalClasses = normalizeArray(classesAssigned, 'classesAssigned[]');
    const finalSections = normalizeArray(
      sectionsAssigned,
      'sectionsAssigned[]'
    );

    // 🔥 Validation: IFSC Code
    if (ifscCode && !ifscRegex.test(ifscCode)) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_IFSC_CODE_FORMAT
      );
    }

    let result;
    if (id) {
      // ✏️ EDIT FLOW
      const teacher = await Teacher.findOne({ _id: id, schoolId });
      if (!teacher) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.TEACHER_NOT_FOUND
        );
      }

      // 🔥 Uniqueness check (excluding self)
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
        let message = responseMessage.ANOTHER_TEACHER_ALREADY_EXISTS;
        if (existingUser.email === email) {
          message = responseMessage.TEACHER_EMAIL_ALREADY_EXISTS;
        } else if (existingUser.phoneNumber === phoneNumber) {
          message = responseMessage.TEACHER_PHONE_ALREADY_EXISTS;
        } else if (attendanceId && existingUser.attendanceId === attendanceId) {
          message = responseMessage.ATTENDANCE_ID_ALREADY_EXISTS;
        }
        return ResponseHandler(res, StatusCodes.CONFLICT, message);
      }

      // 1. Update User identity
      await User.findOneAndUpdate(
        { teacherId: id },
        { email, phoneNumber, attendanceId }
      );

      // 2. Update Teacher profile
      result = await Teacher.findOneAndUpdate(
        { _id: id, schoolId },
        {
          fullName,
          gender,
          dateOfBirth,
          profileImage: finalProfileImage,
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
          subjects: finalSubjects,
          classesAssigned: finalClasses,
          sectionsAssigned: finalSections,
          employmentType,
          salary,
          salaryType,
          bankName,
          accountNumber,
          ifscCode,
          panNumber,
          aadharNumber,
          resume: finalResume,
          idProof: finalIdProof,
          educationCertificates: finalEducationCertificates,
          experienceCertificates: finalExperienceCertificates,
          attendanceId,
          leaveBalance,
          workingHours,
          shiftTiming,
          updatedBy: adminId,
        },
        { new: true }
      );

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.TEACHER_UPDATED,
        result
      );
    } else {
      // ➕ ADD FLOW
      const existingUser = await User.findOne({
        $or: [
          { email },
          { phoneNumber },
          ...(attendanceId ? [{ attendanceId }] : []),
        ],
        schoolId,
      });

      if (existingUser) {
        let message = responseMessage.TEACHER_ALREADY_EXISTS;
        if (existingUser.email === email) {
          message = responseMessage.TEACHER_EMAIL_ALREADY_EXISTS;
        } else if (existingUser.phoneNumber === phoneNumber) {
          message = responseMessage.TEACHER_PHONE_ALREADY_EXISTS;
        } else if (attendanceId && existingUser.attendanceId === attendanceId) {
          message = responseMessage.ATTENDANCE_ID_ALREADY_EXISTS;
        }
        return ResponseHandler(res, StatusCodes.CONFLICT, message);
      }

      const hashedPassword = await encryptPassword(password || 'Teacher@123');

      // 1. Create Teacher profile
      const newTeacher = await Teacher.create({
        fullName,
        gender,
        dateOfBirth,
        profileImage: finalProfileImage,
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
        subjects: finalSubjects,
        classesAssigned: finalClasses,
        sectionsAssigned: finalSections,
        employmentType,
        salary,
        salaryType,
        bankName,
        accountNumber,
        ifscCode,
        panNumber,
        aadharNumber,
        resume: finalResume,
        idProof: finalIdProof,
        educationCertificates: finalEducationCertificates,
        experienceCertificates: finalExperienceCertificates,
        attendanceId,
        leaveBalance,
        workingHours,
        shiftTiming,
        schoolId,
        createdBy: adminId,
        isActive: false,
        isVerified: false,
      });

      // 2. Create User identity
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

      newTeacher.userId = newUser._id;
      await newTeacher.save();

      // 3. Handle OTP
      const rateLimit = await OtpService.checkOtpRateLimit(
        'teacher',
        phoneNumber
      );
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }

      const otp = 444444; // Standardized for development
      await OtpService.storeOtp('teacher', phoneNumber, otp);
      await SmsService.sendSms(phoneNumber, `Your verification code: ${otp}`);

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.TEACHER_ADDED,
        newTeacher
      );
    }
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
      sectionId,
      subjectId,
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      isVerified,
      type,
      joiningDate,
      designation,
      employmentType,
      attendanceId,
    } = req.query;

    const filters = {
      ...req.schoolFilter,
      isActive: type ? true : isActive,
      isVerified: isVerified,
    };

    if (departmentId) filters.departmentId = departmentId;
    if (classId) filters.classesAssigned = classId;
    if (sectionId) filters.sectionsAssigned = sectionId;
    if (subjectId) filters.subjects = subjectId;
    if (joiningDate) filters.joiningDate = joiningDate;
    if (designation) filters.designation = designation;
    if (employmentType) filters.employmentType = employmentType;
    if (attendanceId) filters.attendanceId = attendanceId;

    const result = await queryBuilder(Teacher, {
      pageNumber,
      perPageData,
      searchRequest,
      searchableFields: ['fullName', 'email', 'phoneNumber', 'designation'],
      booleanFields: ['isActive', 'isVerified'],
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

export const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.school_id;

    const teacher = await Teacher.findOne({ _id: id, schoolId }).populate([
      { path: 'departmentId', select: 'name' },
      { path: 'classesAssigned', select: 'name' },
      { path: 'sectionsAssigned', select: 'code' },
      { path: 'subjects', select: 'name' },
      { path: 'userId', select: 'otp otpExpireAt' },
    ]);

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
      responseMessage.TEACHER_FETCH_SUCCESS,
      teacher
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const teacherStatusHandler = async (req, res) => {
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

    const newStatus = !teacher.isActive;

    // Toggle Teacher
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      id,
      { isActive: newStatus },
      { new: true }
    );

    // Sync with User
    await User.findOneAndUpdate({ teacherId: id }, { isActive: newStatus });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TEACHER_STATUS_UPDATED,
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

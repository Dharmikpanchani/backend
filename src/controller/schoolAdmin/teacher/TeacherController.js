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

    // ✅ Handle Files from MediaUpload middleware - Merge new uploads with existing paths
    const finalProfileImage = req.profileImage || profileImage;
    const finalResume = req.resumeFile || resume;
    const finalIdProof = req.idProof || idProof;

    const normalizeFileArray = (newFiles, existingFiles) => {
      const existing = Array.isArray(existingFiles)
        ? existingFiles
        : existingFiles
          ? [existingFiles]
          : [];
      return [...(newFiles || []), ...existing];
    };

    const finalEducationCertificates = normalizeFileArray(
      req.educationCertificates,
      educationCertificates
    );
    const finalExperienceCertificates = normalizeFileArray(
      req.experienceCertificates,
      experienceCertificates
    );

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

      // 2. Update Teacher profile - Build update object dynamically to preserve existing files
      const updateData = {
        fullName,
        gender,
        dateOfBirth,
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
        attendanceId,
        leaveBalance,
        workingHours,
        shiftTiming,
        updatedBy: adminId,
      };

      // Only update file fields if we have a value (new file or existing string)
      if (finalProfileImage) updateData.profileImage = finalProfileImage;
      if (finalResume) updateData.resume = finalResume;
      if (finalIdProof) updateData.idProof = finalIdProof;
      if (finalEducationCertificates.length > 0)
        updateData.educationCertificates = finalEducationCertificates;
      if (finalExperienceCertificates.length > 0)
        updateData.experienceCertificates = finalExperienceCertificates;

      result = await Teacher.findOneAndUpdate(
        { _id: id, schoolId },
        updateData,
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

      // const otp = await generateOtp();
      const otp = 444444;
      await OtpService.storeOtp('teacher', phoneNumber, otp);
      await SmsService.sendOtpSms(
        phoneNumber,
        otp,
        process.env.MSG91_REGISTER_TEMPLATE_ID
      );

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
      joiningDate,
      designation,
      employmentType,
      attendanceId,
    } = req.query;

    const filters = {
      ...req.schoolFilter,
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

    const user = await User.findOne({ teacherId: id });
    if (!user) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    const newStatus = !user.isActive;

    // Toggle User status (Teacher doesn't have status fields anymore)
    user.isActive = newStatus;
    await user.save();

    // Re-fetch teacher to return updated (though status won't be in it)
    const updatedTeacher = await Teacher.findById(id);

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

    // Note: Teacher profile remains but is linked to a deleted User.
    // In the future, you might want to use a lookup/join to hide these.

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

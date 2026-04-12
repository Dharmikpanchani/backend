import SchoolTheme from '../../models/school/SchoolTheme.js';
import Teacher from '../../models/teacher/Teacher.js';
import User from '../../models/user/User.js';
import * as SmsService from '../../services/SmsService.js';
import Admin from '../../models/common/Admin.js';
import { responseMessage } from '../../utils/ResponseMessage.js';
import {
  ResponseHandler,
  CatchErrorHandler,
  encryptPassword,
  queryBuilder,
} from '../../services/CommonServices.js';
import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import {
  forgotPasswordOtpMail,
  sendRegisterVerificationEmail,
} from '../../services/EmailServices.js';
import Logger from '../../utils/Logger.js';
import {
  // generateOtp,
  storeOtp,
  verifyOtp,
  checkOtpRateLimit,
} from '../../services/OtpService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../../services/TokenService.js';
import config from '../../config/Index.js';

const logger = new Logger(
  './src/controller/schoolAdmin/SchoolAdminController.js'
);

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({
      email,
      isDeleted: false,
      schoolId: req.school_id,
      type: config.SCHOOL_ADMIN,
    })
      .populate('role')
      .populate('schoolId');

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_NOT_EXIST
      );
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_CREDENTIALS
      );
    }

    if (!admin.isVerified) {
      const rateLimit = await checkOtpRateLimit('admin', email);
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }
      // const otp = generateOtp();
      const otp = 444444;
      await storeOtp('admin', email, otp);
      await sendRegisterVerificationEmail(
        `Your Admin Register OTP is: ${otp}`,
        email,
        'Admin',
        'Register'
      );
      return ResponseHandler(
        res,
        StatusCodes.OK,
        'Your account is not verified. OTP sent to your email.',
        { requireOtp: true, email: email, type: 'login' }
      );
    }

    if (!admin.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_IS_DISABLED
      );
    }

    if (admin.isSuperAdmin) {
      const rateLimit = await checkOtpRateLimit('admin_login', email);
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }
      // const otp = await generateOtp();
      const otp = 444444;
      await storeOtp('admin_login', email, otp);
      await sendRegisterVerificationEmail(otp, email, 'SuperAdmin', 'Login');

      return ResponseHandler(
        res,
        StatusCodes.OK,
        'OTP sent to your email for verification.',
        { requireOtp: true, email: email }
      );
    }

    const payload = { id: admin._id, type: 'admin' };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setRefreshTokenCookie(res, refreshToken);
    admin.isLogin = true;
    await admin.save();

    const adminData = admin.toObject();
    delete adminData.password;

    const theme = await SchoolTheme.findOne({ schoolId: admin.schoolId });

    // Ensure schoolId is fully populated if not already
    let schoolData = admin.schoolId;
    if (schoolData && typeof schoolData.toObject === 'function') {
      schoolData = schoolData.toObject();
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_LOGIN_SUCCESSFULLY,
      {
        accessToken,
        ...adminData,
        schoolData: { ...schoolData, theme: theme || {} },
      }
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

//#region verifyOtpCommon (Login, Registration, ForgotPassword)
export const verifyOtpCommon = async (req, res) => {
  try {
    const { email, otp, type } = req.body;

    let targetRecord;
    let otpNamespace = '';

    if (type === 'teacher') {
      targetRecord = await Teacher.findOne({
        phoneNumber: email,
        schoolId: req.school_id,
        isDeleted: false,
      });
      otpNamespace = 'teacher';
    } else {
      targetRecord = await Admin.findOne({
        email,
        isDeleted: false,
        type: config.SCHOOL_ADMIN,
        schoolId: req.school_id,
      })
        .populate('role')
        .populate('schoolId');

      if (type === 'login') {
        otpNamespace = targetRecord?.isVerified ? 'admin_login' : 'admin';
      } else if (type === 'registration') {
        otpNamespace = 'admin';
      } else if (type === 'forgotPassword') {
        otpNamespace = 'admin_forgot';
      } else if (type === 'admin_email_change') {
        otpNamespace = 'admin_email_change';
      }
    }

    if (!targetRecord) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        type === 'teacher'
          ? responseMessage.TEACHER_NOT_FOUND
          : responseMessage.ADMIN_NOT_FOUND
      );
    }

    if (!otpNamespace) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OTP_TYPE
      );
    }

    const otpResult = await verifyOtp(otpNamespace, email, otp);
    if (!otpResult.success) {
      if (
        type !== 'teacher' &&
        (type === 'registration' || type === 'login') &&
        otpResult.maxAttemptsReached &&
        !targetRecord.isVerified
      ) {
        await Admin.deleteOne({ _id: targetRecord._id });
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.TOO_MANY_OTP_ATTEMPTS_REGISTRATION_CANCE
        );
      }
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
    }

    if (type === 'login') {
      if (!targetRecord.isVerified) {
        targetRecord.isVerified = true;
        targetRecord.isActive = true;

        if (targetRecord.isSuperAdmin) {
          const school = req.school;
          if (school && !school.isVerified) {
            school.isVerified = true;
            await school.save();
          }
        }
      }
      const payload = { id: targetRecord._id, type: 'admin' };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      setRefreshTokenCookie(res, refreshToken);
      targetRecord.isLogin = true;
      await targetRecord.save();

      const adminData = targetRecord.toObject();
      delete adminData.password;

      // Ensure schoolId is fully populated
      let schoolData = targetRecord.schoolId;
      if (schoolData && typeof schoolData.toObject === 'function') {
        schoolData = schoolData.toObject();
      }
      const theme = await SchoolTheme.findOne({
        schoolId: targetRecord.schoolId,
      });

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ADMIN_LOGIN_SUCCESSFULLY,
        {
          accessToken,
          ...adminData,
          schoolData: { ...schoolData, theme: theme || {} },
        }
      );
    } else if (type === 'registration') {
      targetRecord.isVerified = true;
      targetRecord.isActive = true;
      await targetRecord.save();

      if (targetRecord.isSuperAdmin) {
        const school = req.school;
        if (school && !school.isVerified) {
          school.isVerified = true;
          await school.save();
        }
      }

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ADMIN_VERIFIED_SUCCESSFULLY_YOU_CAN_NOW_
      );
    } else if (type === 'forgotPassword') {
      return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
    } else if (type === 'admin_email_change') {
      return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
    } else if (type === 'teacher') {
      const teacher = await Teacher.findOne({
        phoneNumber: email, // passed as email field
        schoolId: req.school_id,
        isDeleted: false,
      });

      if (!teacher) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.TEACHER_NOT_FOUND
        );
      }

      teacher.isVerified = true;
      teacher.isActive = true;
      await teacher.save();

      await User.findOneAndUpdate(
        { teacherId: teacher._id },
        { isVerified: true, isActive: true }
      );

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.TEACHER_VERIFIED
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

export const refreshToken = async (req, res) => {
  try {
    const { token_id, token_type } = req;

    if (token_type !== 'admin') {
      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.INVALID_TOKEN_TYPE
      );
    }

    const admin = await Admin.findById(token_id);
    if (
      !admin ||
      admin.isDeleted ||
      !admin.isActive ||
      !admin.isVerified ||
      !admin.isLogin
    ) {
      clearRefreshTokenCookie(res);
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_OR_DISABLED_ACCOUNT ||
          'Your session has expired or your account is restricted. Please log in again.'
      );
    }

    const payload = { id: admin._id, type: 'admin' };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    setRefreshTokenCookie(res, newRefreshToken);

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.TOKEN_REFRESHED_SUCCESSFULLY,
      {
        accessToken: newAccessToken,
      }
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const logout = async (req, res) => {
  try {
    const { token_id } = req;
    await Admin.findByIdAndUpdate(token_id, { isLogin: false });
    clearRefreshTokenCookie(res);
    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.LOGGED_OUT_SUCCESSFULLY
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const admin = await Admin.findOne({
      email,
      isDeleted: false,
      schoolId: req.school_id,
      type: config.SCHOOL_ADMIN,
    });
    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_NOT_EXIST
      );
    }

    if (!admin?.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_IS_DISABLED
      );
    }
    if (!admin?.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_NOT_VERIFIED_PLEASE_VERIFY_OTP
      );
    }

    // Rate limit check
    const rateLimit = await checkOtpRateLimit('admin_forgot', email);
    if (rateLimit.limited) {
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );
    }

    // Generate & store OTP via Redis (same as admin creation flow)
    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp('admin_forgot', email, otp);

    await forgotPasswordOtpMail(email, otp);

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.OTP_SENT_SUCCESSFULLY,
      null
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    const admin = await Admin.findOne({
      email,
      isDeleted: false,
      schoolId: req.school_id,
      type: config.SCHOOL_ADMIN,
    });
    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_NOT_EXIST
      );
    }

    if (newPassword !== confirmPassword) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_NOT_MATCH
      );
    }

    admin.password = await encryptPassword(newPassword);
    await admin.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PASSWORD_RESET_SUCCESSFULLY
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const admin = await Admin.findOne({
      _id: req.admin_id,
      isDeleted: false,
      schoolId: req.school_id,
    });
    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_NOT_EXIST
      );
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    if (!isPasswordValid) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OLD_PASSWORD
      );
    }
    if (oldPassword === newPassword) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_ARE_SAME
      );
    }
    if (newPassword !== confirmPassword) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_NOT_MATCH
      );
    } else {
      admin.password = await encryptPassword(newPassword);
      await admin.save();
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.PASSWORD_CHANGE_SUCCESSFULLY
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const profile = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      _id: req.admin_id,
      ...req?.schoolFilter,
    })
      .populate('role')
      .populate({
        path: 'schoolId',
        select: '-referralId -__v',
      });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    const adminObj = admin.toObject();
    const schoolId = adminObj.schoolId;
    const theme = await SchoolTheme.findOne({ schoolId });

    const responseData = {
      ...adminObj,
      schoolData: { ...schoolId, theme: theme || {} },
    };

    delete responseData.schoolId;

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_FETCHED,
      responseData
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phoneNumber } = req.body;
    const existingDuplicate = await Admin.findOne({
      _id: { $ne: req.admin_id },
      $or: [{ email }, { phoneNumber }],
      schoolId: req.school_id,
      isDeleted: false,
    });

    if (existingDuplicate) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.ADMIN_ALREADY_EXISTS
      );
    }

    const update = await Admin.findOneAndUpdate(
      { _id: req.admin_id },
      {
        name,
        email,
        phoneNumber,
        [req.imageUrl ? 'image' : '']: req.imageUrl,
      },
      { new: true }
    );
    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_UPDATED,
      update
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const changeEmailRequest = async (req, res) => {
  try {
    const { password, newEmail } = req.body;
    const adminId = req.admin_id;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_PASSWORD
      );
    }

    const emailExists = await Admin.findOne({
      email: newEmail,
      schoolId: admin.schoolId,
      isDeleted: false,
    });
    if (emailExists) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.EMAIL_ALREADY_EXISTS
      );
    }

    const otp = 444444;
    await storeOtp('admin_email_change', newEmail, otp);
    await sendRegisterVerificationEmail(
      otp,
      newEmail,
      'Admin',
      'Email Change Request'
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.EMAIL_CHANGE_OTP_SENT
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const verifyEmailChange = async (req, res) => {
  try {
    const { newEmail, otp } = req.body;
    const adminId = req.admin_id;

    const otpResult = await verifyOtp('admin_email_change', newEmail, otp);
    if (!otpResult.success) {
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
    }

    const update = await Admin.findByIdAndUpdate(
      adminId,
      { email: newEmail },
      { new: true }
    );
    if (!update) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.EMAIL_UPDATED_SUCCESSFULLY
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ➕ Add / ✏️ Edit Admin Profile
export const addEditAdminProfile = async (req, res) => {
  try {
    const { id, name, email, password, role, address } = req?.body || {};
    const assignedSchoolId = req?.school_id;

    const payload = {
      name,
      email,
      schoolId: assignedSchoolId,
      address,
      type: config.SCHOOL_ADMIN,
    };

    if (password) {
      payload.password = await encryptPassword(password);
    }
    if (role) {
      payload.role = role;
    }

    let result;
    if (id) {
      const existingAdmin = await Admin.findOne({
        _id: id,
        ...req?.schoolFilter,
      });
      if (!existingAdmin)
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.ADMIN_NOT_FOUND
        );

      const duplicateAdmin = await Admin.findOne({
        _id: { $ne: id },
        $or: [{ email }],
        ...req?.schoolFilter,
      });
      if (duplicateAdmin)
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ADMIN_ALREADY_EXISTS
        );

      result = await Admin.findByIdAndUpdate(id, payload, { new: true });
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.PROFILE_UPDATED,
        result
      );
    } else {
      // Create flow — check active admins first
      const duplicateAdmin = await Admin.findOne({
        email,
        ...req?.schoolFilter,
        isDeleted: false,
      });
      if (duplicateAdmin)
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ADMIN_ALREADY_EXISTS
        );

      // Require password for new admins
      if (!password)
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.PASSWORD_IS_REQUIRED_TO_CREATE_A_NEW_ADM
        );

      // Rate limit check
      const rateLimit = await checkOtpRateLimit('admin', email);
      if (rateLimit.limited)
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );

      // ✅ Check if a soft-deleted admin exists with the same email + schoolId.
      // If so, restore it instead of inserting a new document to avoid
      // the unique index conflict on (email, schoolId).
      payload.isVerified = false;
      payload.isDeleted = false;
      payload.isActive = true;
      payload.isLogin = false;

      const deletedAdmin = await Admin.findOne({
        email,
        schoolId: assignedSchoolId,
        isDeleted: true,
      });
      if (deletedAdmin) {
        result = await Admin.findByIdAndUpdate(deletedAdmin._id, payload, {
          new: true,
        });
      } else {
        result = await Admin.create(payload);
      }

      // Send OTP
      // const otp = await generateOtp();
      const otp = 444444;
      await storeOtp('admin', email, otp);
      sendRegisterVerificationEmail(
        `Your Admin Register OTP is: ${otp}`,
        email,
        'Admin',
        'Register'
      ).catch((err) => {
        logger.error(`Error sending Admin Registration OTP: ${err}`);
      });

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.ADMIN_CREATED_OTP_SENT_TO_EMAIL_FOR_VERI,
        { adminId: result._id, email }
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Verify Admin Registration OTP

//#endregion

//#region 🔁 Resend Registration OTP
//#region sendOtp (Common for Login, Registration, ForgotPassword)
export const sendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    let targetRecord;
    let otpNamespace = '';

    if (type === 'teacher') {
      targetRecord = await Teacher.findOne({
        phoneNumber: email,
        isDeleted: false,
        schoolId: req.school_id,
      });
      otpNamespace = 'teacher';
    } else {
      targetRecord = await Admin.findOne({
        email,
        isDeleted: false,
        schoolId: req.school_id,
      });

      if (type === 'login') {
        otpNamespace = targetRecord?.isVerified ? 'admin_login' : 'admin';
      } else if (type === 'registration') {
        otpNamespace = 'admin';
      } else if (type === 'forgotPassword') {
        otpNamespace = 'admin_forgot';
      } else if (type === 'admin_email_change') {
        otpNamespace = 'admin_email_change';
      }
    }

    if (!targetRecord) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        type === 'teacher'
          ? responseMessage.TEACHER_NOT_FOUND
          : responseMessage.ADMIN_NOT_FOUND
      );
    }

    if (!otpNamespace) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OTP_TYPE
      );
    }

    if (type === 'registration' && targetRecord.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_IS_ALREADY_VERIFIED_NO_OTP_NEEDED
      );
    }

    const rateLimit = await checkOtpRateLimit(otpNamespace, email);
    if (rateLimit.limited) {
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );
    }

    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp(otpNamespace, email, otp);

    if (type === 'login') {
      if (!targetRecord.isVerified) {
        sendRegisterVerificationEmail(
          `Your Admin Register OTP is: ${otp}`,
          email,
          'Admin',
          'Register'
        ).catch((err) => logger.error(err));
      } else {
        await sendRegisterVerificationEmail(otp, email, 'SuperAdmin', 'Login');
      }
    } else if (type === 'registration') {
      sendRegisterVerificationEmail(
        `Your Admin Register OTP is: ${otp}`,
        email,
        'Admin',
        'Register'
      ).catch((err) => logger.error(err));
    } else if (type === 'forgotPassword') {
      await forgotPasswordOtpMail(email, otp);
    } else if (type === 'admin_email_change') {
      await sendRegisterVerificationEmail(
        otp,
        email,
        'Admin',
        'Email Change Request'
      );
    } else if (type === 'teacher') {
      await SmsService.sendSms(email, `Your verification code: ${otp}`);
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.OTP_SENT_SUCCESSFULLY
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#endregion

//#region 📄 Get All Admins
export const getAllAdmins = async (req, res) => {
  try {
    const {
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      isVerified,
      type,
    } = req?.query || {};

    const filters = {
      ...req?.schoolFilter,
      isActive: type ? true : isActive,
      isVerified,
    };

    const result = await queryBuilder(Admin, {
      pageNumber,
      perPageData,
      searchRequest,
      searchableFields: ['name', 'email', 'phoneNumber', 'address'],
      booleanFields: ['isActive', 'isVerified'],
      filters,
      populate: [{ path: 'role', select: 'role isActive' }],
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_FETCH_SUCCESS,
      result
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};

export const getAdminById = async (req, res) => {
  try {
    const { id } = req?.params || {};
    const admin = await Admin.findOne({
      _id: id,
      ...req?.schoolFilter,
    }).populate({ path: 'role', select: 'role isActive' });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_FETCH_SUCCESS,
      admin
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Admin (Soft Delete)
export const deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      _id: req?.params?.id,
      ...req?.schoolFilter,
    });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    if (admin.isSuperAdmin) {
      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.SUPER_ADMIN_CANNOT_BE_DELETED
      );
    }

    // ✅ Scramble the email to free the unique index slot (email, schoolId).
    // This allows the same email to be re-registered later without an E11000 error.
    const scrambledEmail = `${admin.email}_deleted_${Date.now()}`;
    await Admin.findByIdAndUpdate(admin._id, {
      isDeleted: true,
      email: scrambledEmail,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚡ Admin Status Handler (Toggle Active)
export const adminStatusHandler = async (req, res) => {
  try {
    const { id } = req?.params || {};

    const admin = await Admin.findOne({
      _id: id,
      ...req?.schoolFilter,
    });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      id,
      { isActive: !admin.isActive },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_STATUS_UPDATED,
      updatedAdmin
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

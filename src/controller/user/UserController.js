import { StatusCodes } from 'http-status-codes';
import SchoolTheme from '../../models/school/SchoolTheme.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  encryptPassword,
} from '../../services/CommonServices.js';
import { responseMessage } from '../../utils/ResponseMessage.js';
import bcrypt from 'bcryptjs';
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
} from '../../services/TokenService.js';
import User from '../../models/user/User.js';
import Teacher from '../../models/teacher/Teacher.js';
import Student from '../../models/student/Student.js';
import * as OtpService from '../../services/OtpService.js';
import * as SmsService from '../../services/SmsService.js';
import config from '../../config/Index.js';

//#region 🏫 Get School Profile by School Code
export const getSchoolProfile = async (req, res) => {
  try {
    const school = req.school;

    const theme = await SchoolTheme.findOne({ schoolId: school._id });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_RETRIEVED_SUCCESSFULLY,
      {
        school: {
          ...school.toObject(),
          theme: theme || {},
        },
      }
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};

//#region 👤 Get User Profile (Authenticated)
export const getProfile = async (req, res) => {
  try {
    const userProfile = req.user;
    const userIdentity = req.userIdentity;
    const school = req.school;

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    const theme = await SchoolTheme.findOne({ schoolId: school._id });

    const data = {
      profile: userProfile,
      identity: userIdentity,
      school: {
        ...school.toObject(),
        theme: theme || {},
      },
    };

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_FOUND,
      data
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion
//#endregion

//#region 🔑 User Login
export const login = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    const school = req.school;

    // 1. Find Record in User model (Auth Identity)
    const userIdentity = await User.findOne({
      phoneNumber,
      schoolId: school._id,
      isDeleted: false,
    });

    if (!userIdentity) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    let userProfile;
    if (userIdentity.userType === config.TEACHER) {
      userProfile = await Teacher.findOne({
        _id: userIdentity.teacherId,
        isDeleted: false,
      });
    } else if (userIdentity.userType === config.STUDENT) {
      userProfile = await Student.findOne({
        _id: userIdentity.studentId,
        isDeleted: false,
      });
    }

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    // 2. Verify Password
    const isPasswordValid = await bcrypt.compare(
      password,
      userProfile.password
    );
    if (!isPasswordValid) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_CREDENTIALS
      );
    }

    if (!userProfile.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_ACTIVE
      );
    }

    if (!userProfile.isVerified) {
      const otpNamespace =
        userIdentity.userType === config.TEACHER
          ? config.TEACHER
          : config.STUDENT;
      const rateLimit = await OtpService.checkOtpRateLimit(
        otpNamespace,
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
      await OtpService.storeOtp(otpNamespace, phoneNumber, otp);
      await SmsService.sendSms(phoneNumber, `Your verification code: ${otp}`);

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ACCOUNT_NOT_VERIFIED,
        {
          requireOtp: true,
          phoneNumber,
          type: 'login',
          userType: userIdentity.userType,
        }
      );
    }

    // 3. Generate Tokens
    const payload = {
      id: userIdentity._id,
      profileId: userProfile._id,
      type: 'user',
      userType: userIdentity.userType,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setRefreshTokenCookie(res, refreshToken);

    // 4. Update last login
    userProfile.lastLogin = new Date();
    userProfile.isLogin = true;
    await userProfile.save();

    const userData = userProfile.toObject();
    delete userData.password;

    const theme = await SchoolTheme.findOne({ schoolId: school._id });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.USER_LOGIN_SUCCESSFULLY,
      {
        accessToken,
        user: { ...userData, userType: userIdentity.userType },
        school: {
          ...school.toObject(),
          theme: theme || {},
        },
      }
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📨 Send OTP (Login / Forgot Password)
export const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const school = req.school;

    const userIdentity = await User.findOne({
      phoneNumber,
      schoolId: school._id,
      isDeleted: false,
    });

    if (!userIdentity) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    const otpNamespace = userIdentity.userType;
    const rateLimit = await OtpService.checkOtpRateLimit(
      otpNamespace,
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
    await OtpService.storeOtp(otpNamespace, phoneNumber, otp);
    await SmsService.sendSms(phoneNumber, `Your verification code: ${otp}`);

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.OTP_SENT_SUCCESSFULLY
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔐 Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp, type } = req.body;
    const school = req.school;

    const userIdentity = await User.findOne({
      phoneNumber,
      schoolId: school._id,
      isDeleted: false,
    });

    if (!userIdentity) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    const otpNamespace = userIdentity.userType;
    const otpResult = await OtpService.verifyOtp(
      otpNamespace,
      phoneNumber,
      otp
    );

    if (!otpResult.success) {
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
    }

    let userProfile;
    if (userIdentity.userType === config.TEACHER) {
      userProfile = await Teacher.findOne({
        _id: userIdentity.teacherId,
        isDeleted: false,
      });
    } else if (userIdentity.userType === config.STUDENT) {
      userProfile = await Student.findOne({
        _id: userIdentity.studentId,
        isDeleted: false,
      });
    }

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    // If verifying for login, complete the activation and return tokens
    if (type === 'login') {
      if (!userProfile.isVerified) {
        userProfile.isVerified = true;
        userProfile.isActive = true;
        await userProfile.save();

        userIdentity.isActive = true;
        userIdentity.isVerified = true;
        await userIdentity.save();
      }

      const payload = {
        id: userIdentity._id,
        profileId: userProfile._id,
        type: 'user',
        userType: userIdentity.userType,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      setRefreshTokenCookie(res, refreshToken);

      userProfile.isLogin = true;
      userProfile.lastLogin = new Date();
      await userProfile.save();

      const userData = userProfile.toObject();
      delete userData.password;
      const theme = await SchoolTheme.findOne({ schoolId: school._id });

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.OTP_VERIFIED,
        {
          accessToken,
          user: { ...userData, userType: userIdentity.userType },
          school: { ...school.toObject(), theme: theme || {} },
        }
      );
    }

    return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ❓ Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const school = req.school;

    const userIdentity = await User.findOne({
      phoneNumber,
      schoolId: school._id,
      isDeleted: false,
    });

    if (!userIdentity) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    const otpNamespace = userIdentity.userType;
    const rateLimit = await OtpService.checkOtpRateLimit(
      otpNamespace,
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
    await OtpService.storeOtp(otpNamespace, phoneNumber, otp);
    await SmsService.sendSms(
      phoneNumber,
      `Your forgot password verification code: ${otp}`
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.OTP_SENT_SUCCESSFULLY
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔄 Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { phoneNumber, newPassword } = req.body;
    const school = req.school;

    const userIdentity = await User.findOne({
      phoneNumber,
      schoolId: school._id,
      isDeleted: false,
    });

    if (!userIdentity) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    const hashedPassword = await encryptPassword(newPassword);

    if (userIdentity.userType === config.TEACHER) {
      await Teacher.findByIdAndUpdate(userIdentity.teacherId, {
        password: hashedPassword,
      });
    } else if (userIdentity.userType === config.STUDENT) {
      await Student.findByIdAndUpdate(userIdentity.studentId, {
        password: hashedPassword,
      });
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PASSWORD_RESET_SUCCESSFULLY
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔄 Change Password (Authenticated)
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userProfile = req.user; // Directly using profile from middleware

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      userProfile.password
    );
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

    userProfile.password = await encryptPassword(newPassword);
    await userProfile.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PASSWORD_CHANGE_SUCCESSFULLY
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

import { StatusCodes } from 'http-status-codes';
import SchoolTheme from '../../models/school/SchoolTheme.js';
import School from '../../models/school/School.js';
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
  clearRefreshTokenCookie,
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

//#region 🏫 Get All School Codes for Sitemap
export const getSchoolCodes = async (req, res) => {
  try {
    const schools = await School.find({
      isActive: true,
      isDeleted: false,
    }).select('schoolCode');

    const codes = schools.map((s) => s.schoolCode);

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_RETRIEVED_SUCCESSFULLY,
      codes
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 👤 Get User Profile (Authenticated)
export const getProfile = async (req, res) => {
  try {
    const { userIdentity, userType, school } = req;

    let userProfile;
    if (userType === config.TEACHER) {
      userProfile = await Teacher.findById(userIdentity.teacherId)
        .populate('departmentId')
        .populate('subjects')
        .populate('classesAssigned')
        .populate('sectionsAssigned')
        .populate({
          path: 'schoolId',
          select: '-referralId -__v',
        });
    } else if (userType === config.STUDENT) {
      userProfile = await Student.findById(userIdentity.studentId)
        .populate('classId')
        .populate('sectionId')
        .populate({
          path: 'schoolId',
          select: '-referralId -__v',
        });
    }

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    const theme = await SchoolTheme.findOne({ schoolId: school._id });

    const userProfileObj = userProfile.toObject();
    const schoolData = userProfileObj.schoolId;

    const responseData = {
      ...userProfileObj,
      identity: userIdentity,
      userType: userType,
      schoolData: { ...schoolData, theme: theme || {} },
    };

    delete responseData.schoolId;
    delete responseData.password;

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_FOUND,
      responseData
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
      });
    } else if (userIdentity.userType === config.STUDENT) {
      userProfile = await Student.findOne({
        _id: userIdentity.studentId,
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

    if (!userIdentity.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_ACTIVE
      );
    }

    if (!userIdentity.isVerified) {
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

      // const otp = await generateOtp();
      const otp = 444444;
      await OtpService.storeOtp(otpNamespace, phoneNumber, otp);
      await SmsService.sendOtpSms(
        phoneNumber,
        otp,
        process.env.MSG91_LOGIN_TEMPLATE_ID
      );

      return ResponseHandler(
        res,
        StatusCodes.OK,
        'Your account is not verified. OTP sent to your phone number.',
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
    userIdentity.lastLogin = new Date();
    userIdentity.isLogin = true;
    await userIdentity.save();

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

    // const otp = await generateOtp();
    const otp = 444444;
    await OtpService.storeOtp(otpNamespace, phoneNumber, otp);
    const templateId =
      req.body.type === 'forgotPassword'
        ? process.env.MSG91_FORGOT_TEMPLATE_ID
        : process.env.MSG91_LOGIN_TEMPLATE_ID;
    await SmsService.sendOtpSms(phoneNumber, otp, templateId);

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
      });
    } else if (userIdentity.userType === config.STUDENT) {
      userProfile = await Student.findOne({
        _id: userIdentity.studentId,
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
      if (!userIdentity.isVerified) {
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

      userIdentity.isLogin = true;
      userIdentity.lastLogin = new Date();
      await userIdentity.save();

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

    // const otp = await generateOtp();
    const otp = 444444;
    await OtpService.storeOtp(otpNamespace, phoneNumber, otp);
    await SmsService.sendOtpSms(
      phoneNumber,
      otp,
      process.env.MSG91_FORGOT_TEMPLATE_ID
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
export const changePhoneNumberRequest = async (req, res) => {
  try {
    const { password, newPhoneNumber } = req.body;
    const userProfile = req.user;

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      userProfile.password
    );
    if (!isPasswordValid) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_PASSWORD
      );
    }

    // Check if phone exists in the same school for any user/teacher/student
    const phoneExists = await Teacher.findOne({
      phoneNumber: newPhoneNumber,
      schoolId: userProfile.schoolId,
    });
    const studentPhoneExists = await Student.findOne({
      phoneNumber: newPhoneNumber,
      schoolId: userProfile.schoolId,
    });

    if (phoneExists || studentPhoneExists) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.PHONE_NUMBER_ALREADY_EXISTS
      );
    }

    // const otp = await generateOtp();
    const otp = 444444;
    await OtpService.storeOtp('user_phone_change', newPhoneNumber, otp);
    await SmsService.sendOtpSms(
      newPhoneNumber,
      otp,
      process.env.MSG91_REGISTER_TEMPLATE_ID
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

export const verifyPhoneNumberChange = async (req, res) => {
  try {
    const { newPhoneNumber, otp } = req.body;
    const userProfile = req.user;

    const otpResult = await OtpService.verifyOtp(
      'user_phone_change',
      newPhoneNumber,
      otp
    );
    if (!otpResult.success) {
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
    }

    // Update the phone number in the current profile
    userProfile.phoneNumber = newPhoneNumber;
    await userProfile.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PHONE_NUMBER_UPDATED_SUCCESSFULLY
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { token_id, token_type } = req;

    if (token_type !== 'user') {
      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.INVALID_TOKEN_TYPE
      );
    }

    const userIdentity = await User.findById(token_id);
    if (!userIdentity || userIdentity.isDeleted) {
      clearRefreshTokenCookie(res);
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_OR_DISABLED_ACCOUNT ||
          'Your session has expired or your account is restricted. Please log in again.'
      );
    }

    let userProfile;
    if (userIdentity.userType === config.TEACHER) {
      userProfile = await Teacher.findById(userIdentity.teacherId);
    } else if (userIdentity.userType === config.STUDENT) {
      userProfile = await Student.findById(userIdentity.studentId);
    }

    if (
      !userProfile ||
      userIdentity.isDeleted ||
      !userIdentity.isActive ||
      !userIdentity.isLogin
    ) {
      clearRefreshTokenCookie(res);
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_OR_DISABLED_ACCOUNT ||
          'Your session has expired or your account is restricted. Please log in again.'
      );
    }

    const payload = {
      id: userIdentity._id,
      profileId: userProfile._id,
      type: 'user',
      userType: userIdentity.userType,
    };
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
    return CatchErrorHandler(res, error);
  }
};

export const logout = async (req, res) => {
  try {
    const { token_id } = req;
    const userIdentity = await User.findById(token_id);

    if (userIdentity) {
      userIdentity.isLogin = false;
      await userIdentity.save();
    }

    clearRefreshTokenCookie(res);
    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.LOGGED_OUT_SUCCESSFULLY
    );
  } catch (error) {
    return CatchErrorHandler(res, error);
  }
};
//#endregion

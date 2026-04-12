import User from '../../models/user/User.js';
import Teacher from '../../models/teacher/Teacher.js';
import { responseMessage } from '../../utils/ResponseMessage.js';
import {
  ResponseHandler,
  CatchErrorHandler,
  encryptPassword,
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

const logger = new Logger('./src/controller/user/UserController.js');

//#region Create User (Signup with OTP)
export const createUser = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, gender } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
      isDeleted: false,
    });

    if (existingUser) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_ALREADY_EXIST
      );
    }

    const rateLimit = await checkOtpRateLimit('user', email);
    if (rateLimit.limited)
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );

    const hashedPassword = await encryptPassword(password);

    const newUser = await User.create({
      fullName,
      email,
      gender,
      password: hashedPassword,
      phoneNumber,
      isActive: false,
      isVerify: false,
    });

    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp('user', email, otp);

    if (email) {
      // Reusing email service, could be improved with dynamic template
      await sendRegisterVerificationEmail(email, otp, 'User');
    }

    return ResponseHandler(
      res,
      StatusCodes.CREATED,
      responseMessage.USER_SIGNUP_SUCCESSFULLY,
      {
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
      }
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Verify Signup OTP
export const verifySignup = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );
    if (user.isVerify)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_ALREADY_VERIFIED
      );

    const otpResult = await verifyOtp('user', email, otp);
    if (!otpResult.success) {
      if (otpResult.maxAttemptsReached && !user.isVerify) {
        await User.deleteOne({ _id: user._id });
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.TOO_MANY_OTP_ATTEMPTS_REGISTRATION_CANCE
        );
      }
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
    }

    user.isVerify = true;
    user.isActive = true;
    await user.save();

    return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Login Step 1: Check credentials & Send OTP
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isDeleted: false });
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_CREDENTIALS
      );

    if (!user.isVerify)
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.PLEASE_VERIFY_YOUR_ACCOUNT_FIRST
      );
    if (!user.isActive)
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.YOUR_ACCOUNT_IS_DISABLED
      );

    // Rate Limit check for OTP
    const rateLimit = await checkOtpRateLimit('user_login', email);
    if (rateLimit.limited)
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );

    // Send Login OTP
    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp('user_login', email, otp);

    // Abstracting email send
    await sendRegisterVerificationEmail(email, otp, 'User');

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.CREDENTIALS_VERIFIED_OTP_SENT_TO_EMAIL_T,
      { email }
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Login Step 2: Verify Login OTP and Return Tokens
export const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email, isDeleted: false });
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );

    const otpResult = await verifyOtp('user_login', email, otp);
    if (!otpResult.success)
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);

    const payload = { id: user._id, type: 'user' };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setRefreshTokenCookie(res, refreshToken);
    user.isLogin = true;
    user.lastLogin = new Date();
    await user.save();

    if (user.userType === 'teacher' && user.teacherId) {
      await Teacher.findByIdAndUpdate(user.teacherId, {
        lastLogin: new Date(),
      });
    }

    const userData = user.toObject();
    delete userData.password;

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.USER_LOGIN_SUCCESSFULLY,
      {
        accessToken,
        user: userData,
      }
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Refresh Token
export const refreshToken = async (req, res) => {
  try {
    const { token_id, token_type } = req;

    if (token_type !== 'user')
      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.INVALID_TOKEN_TYPE
      );

    const user = await User.findById(token_id);
    if (!user || user.isDeleted || !user.isActive || !user.isLogin) {
      clearRefreshTokenCookie(res);
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_OR_DISABLED_ACCOUNT ||
          'Your session has expired. Please log in again.'
      );
    }

    const payload = { id: user._id, type: 'user' };
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
//#endregion

//#region Logout
export const logout = async (req, res) => {
  try {
    const { token_id } = req;
    await User.findByIdAndUpdate(token_id, { isLogin: false });
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
//#endregion

//#region Forgot Password (Send OTP)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email, isDeleted: false });
    if (!user) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );
    }

    if (!user.isVerify) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PLEASE_VERIFY_YOUR_ACCOUNT_FIRST
      );
    }

    if (!user.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.YOUR_ACCOUNT_IS_DISABLED
      );
    }

    const rateLimit = await checkOtpRateLimit('user_forgot', email);
    if (rateLimit.limited)
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );

    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp('user_forgot', email, otp);
    await forgotPasswordOtpMail(email, otp);

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

//#region Verify Forgot Password OTP
export const verifyOtpAction = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email, isDeleted: false });
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );

    const otpResult = await verifyOtp('user_forgot', email, otp);
    if (!otpResult.success)
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);

    return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    const user = await User.findOne({ email, isDeleted: false });
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );

    if (newPassword !== confirmPassword)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_NOT_MATCH
      );

    user.password = await encryptPassword(newPassword);
    await user.save();

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
//#endregion

//#region Change Password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findOne({ _id: req.user_id, isDeleted: false });
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OLD_PASSWORD
      );

    if (oldPassword === newPassword)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_ARE_SAME
      );
    if (newPassword !== confirmPassword)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_NOT_MATCH
      );

    user.password = await encryptPassword(newPassword);
    await user.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PASSWORD_CHANGE_SUCCESSFULLY
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Profile
export const profile = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user_id, isDeleted: false })
      .select('-password')
      .lean();
    if (!user)
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.USER_NOT_EXIST
      );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_FETCHED,
      user
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phoneNumber } = req.body;
    const update = await User.findOneAndUpdate(
      { _id: req.user_id },
      {
        fullName,
        email,
        phoneNumber,
        [req.imageUrl ? 'image' : '']: req.imageUrl,
      },
      { new: true }
    ).select('-password');
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
//#endregion

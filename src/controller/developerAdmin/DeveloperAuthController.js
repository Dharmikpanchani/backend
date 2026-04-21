import Admin from '../../models/common/Admin.js';
import School from '../../models/school/School.js';
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
  './src/controller/developerAdmin/DeveloperAuthController.js'
);

//#region Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Developers do not have a schoolCode restriction
    const developer = await Admin.findOne({
      email,
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
      isDeleted: false,
    }).populate('role');

    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }
    const isPasswordValid = await bcrypt.compare(password, developer.password);
    if (!isPasswordValid) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_CREDENTIALS
      );
    }

    if (!developer.isVerified) {
      const rateLimit = await checkOtpRateLimit('developer', email);
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }
      // const otp = await generateOtp();
      const otp = 444444;
      await storeOtp('developer', email, otp);
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

    if (!developer.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_IS_DISABLED
      );
    }

    if (developer?.type == config.SUPER_ADMIN) {
      const rateLimit = await checkOtpRateLimit('developer_login', email);
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }
      // const otp = await generateOtp();
      // const otp = await generateOtp();
      const otp = 444444;
      await storeOtp('developer_login', email, otp);
      await sendRegisterVerificationEmail(
        otp,
        email,
        'SuperDeveloper',
        'Login'
      );

      return ResponseHandler(
        res,
        StatusCodes.OK,
        'OTP sent to your email for verification.',
        { requireOtp: true, email: email }
      );
    }

    const payload = { id: developer._id, type: 'developer' };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setRefreshTokenCookie(res, refreshToken);

    if (developer) {
      developer.isLogin = true;
      await developer.save();
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_LOGIN_SUCCESSFULLY,
      {
        accessToken,
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

    // Strict typing
    if (token_type !== 'developer') {
      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.INVALID_TOKEN_TYPE
      );
    }

    const developer = await Admin.findById(token_id);
    if (
      !developer ||
      developer?.isDeleted ||
      !developer?.isActive ||
      !developer?.isVerified ||
      !developer?.isLogin
    ) {
      clearRefreshTokenCookie(res);
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_OR_DISABLED_ACCOUNT ||
          'Your session has expired or your account is restricted. Please log in again.'
      );
    }

    const payload = { id: developer._id, type: 'developer' };
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
    await Admin.findByIdAndUpdate({ _id: token_id }, { isLogin: false });

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

//#region Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const developer = await Admin.findOne({
      email,
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
      isDeleted: false,
    });
    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }
    if (!developer?.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_IS_DISABLED
      );
    }
    if (!developer?.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_NOT_VERIFIED_PLEASE_VERIFY_OTP
      );
    }

    const rateLimit = await checkOtpRateLimit('developer_forgot', email);
    if (rateLimit.limited) {
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );
    }

    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp('developer_forgot', email, otp);
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

//#region Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    const developer = await Admin.findOne({
      email,
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
      isDeleted: false,
    });
    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }

    if (newPassword !== confirmPassword) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_NOT_MATCH
      );
    }

    developer.password = await encryptPassword(newPassword);
    await developer.save();

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

    const developer = await Admin.findOne({
      _id: req.developer_id,
      isDeleted: false,
    });
    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }

    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      developer.password
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
    if (newPassword !== confirmPassword) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PASSWORD_NOT_MATCH
      );
    }

    developer.password = await encryptPassword(newPassword);
    await developer.save();

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

//#region Get Profile
export const profile = async (req, res) => {
  try {
    const developer = await Admin.findOne({
      _id: req.developer_id,
      isDeleted: false,
    })
      .select('-isDeleted -__v')
      .populate({
        path: 'role',
        select: 'role permissions',
      });

    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_FETCHED,
      developer
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
    const { name, phoneNumber, address } = req.body;

    const updateData = { name, phoneNumber, address };

    if (req.imageUrl) {
      updateData.image = req.imageUrl;
    }

    const update = await Admin.findOneAndUpdate(
      { _id: req.developer_id },
      { $set: updateData },
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

export const changeEmailRequest = async (req, res) => {
  try {
    const { password, newEmail } = req.body;
    const adminId = req.developer_id;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEVELOPER_NOT_FOUND
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
      isDeleted: false,
    });
    if (emailExists) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.EMAIL_ALREADY_EXISTS
      );
    }
    // const otp = generateOtp();
    const otp = 444444;
    await storeOtp('developer_email_change', newEmail, otp);
    await sendRegisterVerificationEmail(
      otp,
      newEmail,
      'Developer',
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
    const adminId = req.developer_id;

    const otpResult = await verifyOtp('developer_email_change', newEmail, otp);
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
        responseMessage.DEVELOPER_NOT_FOUND
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

//#region Verify OTP Common
export const verifyOtpCommon = async (req, res) => {
  try {
    const { email, otp, type } = req.body;

    if (type === 'schoolRegistration') {
      const school = await School.findOne({ email });
      if (!school) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SCHOOL_NOT_FOUND
        );
      }

      const admin = await Admin.findOne({
        email,
        schoolId: school._id,
        type: config.SCHOOL_ADMIN,
      });
      if (!admin) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.ADMIN_NOT_FOUND_FOR_THIS_SCHOOL
        );
      }

      if (admin.isVerified) {
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.SCHOOL_IS_ALREADY_VERIFIED
        );
      }

      const otpResult = await verifyOtp('admin', email, otp);
      if (!otpResult.success) {
        if (otpResult.maxAttemptsReached && !admin.isVerified) {
          await School.deleteOne({ _id: school._id });
          await Admin.deleteOne({ _id: admin._id });
          return ResponseHandler(
            res,
            StatusCodes.BAD_REQUEST,
            responseMessage.TOO_MANY_OTP_ATTEMPTS_REGISTRATION_CANCE_1
          );
        }
        return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
      }

      school.isVerified = true;
      school.isActive = true;
      await school.save();

      admin.isVerified = true;
      admin.isActive = true;
      await admin.save();

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.SCHOOL_EMAIL_VERIFIED_AND_ACCOUNT_ACTIVA
      );
    }

    const developer = await Admin.findOne({
      email,
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
      isDeleted: false,
    }).populate('role');

    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }

    let otpType = '';
    if (type === 'login') {
      otpType = developer.isVerified ? 'developer_login' : 'developer';
    } else if (type === 'registration') {
      otpType = 'developer';
    } else if (type === 'forgotPassword') {
      otpType = 'developer_forgot';
    } else if (type === 'developer_email_change') {
      otpType = 'developer_email_change';
    } else
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OTP
      );

    if (type === 'registration' && developer?.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_ALREADY_VERIFIED
      );
    }

    const otpResult = await verifyOtp(otpType, email, otp);
    if (!otpResult.success) {
      if (
        (type === 'registration' || type === 'login') &&
        otpResult.maxAttemptsReached &&
        !developer.isVerified
      ) {
        await Admin.deleteOne({ _id: developer._id });
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.TOO_MANY_OTP_ATTEMPTS_REGISTRATION_CANCE
        );
      }
      return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
    }

    if (type === 'login') {
      if (developer && !developer.isVerified) {
        developer.isVerified = true;
        developer.isActive = true;
      }
      const payload = { id: developer._id, type: 'developer' };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      setRefreshTokenCookie(res, refreshToken);
      if (developer) {
        developer.isLogin = true;
        await developer.save();
      }
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ADMIN_LOGIN_SUCCESSFULLY,
        { accessToken }
      );
    } else if (type === 'registration') {
      if (developer) {
        developer.isVerified = true;
        developer.isActive = true;
        await developer.save();
      }
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ADMIN_VERIFIED_SUCCESSFULLY_YOU_CAN_NOW_
      );
    } else if (type === 'forgotPassword') {
      return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
    } else if (type === 'developer_email_change') {
      return ResponseHandler(res, StatusCodes.OK, responseMessage.OTP_VERIFIED);
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion
//#region Send OTP Common
export const sendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    if (type === 'schoolRegistration') {
      const school = await School.findOne({ email });
      if (!school) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SCHOOL_NOT_FOUND_1
        );
      }
      const rateLimit = await checkOtpRateLimit('school', email);
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }

      // const otp = await generateOtp();
      // const otp = await generateOtp();
      const otp = 444444;
      await storeOtp('admin', email, otp); // Same as registration

      const { sendSubscriptionBaseMail } =
        await import('../../services/EmailServices.js');
      sendSubscriptionBaseMail(`<span style="color:#4f46e5;">${otp}</span>`, [
        email,
      ]).catch((err) => logger.error(`Error sending OTP email: ${err}`));

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.OTP_RESENT_SUCCESSFULLY
      );
    }

    const developer = await Admin.findOne({
      email,
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
      isDeleted: false,
    });

    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }

    let otpType = '';
    if (type === 'login') {
      otpType = developer.isVerified ? 'developer_login' : 'developer';
    } else if (type === 'registration') {
      otpType = 'developer';
    } else if (type === 'forgotPassword') {
      otpType = 'developer_forgot';
    } else if (type === 'developer_email_change' || type === 'admin_update') {
      otpType = type;
    } else
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_OTP_TYPE
      );

    if (type === 'registration' && developer?.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_IS_ALREADY_VERIFIED_NO_OTP_NEEDED
      );
    }

    const rateLimit = await checkOtpRateLimit(otpType, email);
    if (rateLimit.limited) {
      return ResponseHandler(
        res,
        StatusCodes.TOO_MANY_REQUESTS,
        rateLimit.message
      );
    }

    // const otp = await generateOtp();
    const otp = 444444;
    await storeOtp(otpType, email, otp);

    if (type === 'login') {
      if (!developer.isVerified) {
        sendRegisterVerificationEmail(
          `Your Admin Register OTP is: ${otp}`,
          email,
          'Admin',
          'Register'
        ).catch((err) => logger.error(err));
      } else {
        await sendRegisterVerificationEmail(
          otp,
          email,
          'SuperDeveloper',
          'Login'
        );
      }
    } else if (type === 'admin_update') {
      sendRegisterVerificationEmail(
        `Your Admin Update Verification OTP is: ${otp}`,
        email,
        'Admin',
        'Profile Update'
      ).catch((err) => logger.error(err));
    } else if (type === 'registration') {
      sendRegisterVerificationEmail(
        `Your Admin Register OTP is: ${otp}`,
        email,
        'Admin'
      ).catch((err) =>
        logger.error(`Error re-sending Admin Registration OTP: ${err}`)
      );
    } else if (type === 'forgotPassword') {
      await forgotPasswordOtpMail(email, otp);
    } else if (type === 'developer_email_change') {
      await sendRegisterVerificationEmail(
        otp,
        email,
        'Developer',
        'Email Change Request'
      );
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

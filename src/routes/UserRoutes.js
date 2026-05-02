import { Router } from 'express';
import * as UserController from '../controller/user/UserController.js';
import * as SchoolController from '../controller/school/SchoolController.js';
import { authLimiter } from '../middleware/RateLimit.js';
import { validator } from '../middleware/Validator.js';
import { schoolScope, userAuth, refreshTokenAuth } from '../middleware/Auth.js';

const userRoutes = Router();

userRoutes.use('/login', authLimiter);
userRoutes.use('/re-send-otp', authLimiter);
userRoutes.use('/verify-otp', authLimiter);
userRoutes.use('/forgot-password', authLimiter);
userRoutes.use('/reset-password', authLimiter);

userRoutes.post(
  '/get-school-image',
  schoolScope,
  validator('getSchoolImageSchema'),
  SchoolController.getSchoolImageByCode
);
userRoutes.get('/all-school-codes', UserController.getSchoolCodes);

userRoutes.get('/profile', userAuth, schoolScope, UserController.getProfile);

userRoutes.post(
  '/getSchool-profile',
  userAuth,
  schoolScope,
  validator('getSchoolProfileSchema'),
  UserController.getSchoolProfile
);

userRoutes.post(
  '/login',
  schoolScope,
  validator('userLoginSchema'),
  UserController.login
);

userRoutes.post(
  '/re-send-otp',
  schoolScope,
  validator('userSendOtpSchema'),
  UserController.sendOtp
);

userRoutes.post(
  '/verify-otp',
  schoolScope,
  validator('userVerifyOtpSchema'),
  UserController.verifyOtp
);

userRoutes.post(
  '/forgot-password',
  schoolScope,
  validator('userForgotPasswordSchema'),
  UserController.forgotPassword
);

userRoutes.post(
  '/reset-password',
  schoolScope,
  validator('userResetPasswordSchema'),
  UserController.resetPassword
);

userRoutes.post(
  '/refresh-token',
  refreshTokenAuth,
  UserController.refreshToken
);

userRoutes.post('/logout', refreshTokenAuth, UserController.logout);

userRoutes.post(
  '/change-password',
  userAuth,
  schoolScope,
  validator('changePasswordSchema'),
  UserController.changePassword
);

userRoutes.post(
  '/change-phone-request',
  userAuth,
  schoolScope,
  UserController.changePhoneNumberRequest
);

userRoutes.post(
  '/verify-phone-change',
  userAuth,
  schoolScope,
  UserController.verifyPhoneNumberChange
);

export default userRoutes;

import { Router } from 'express';
import * as UserController from '../controller/user/UserController.js';
import { authLimiter } from '../middleware/RateLimit.js';
import { validator } from '../middleware/Validator.js';
import { schoolScope, userAuth } from '../middleware/Auth.js';

const userRoutes = Router();

userRoutes.use('/login', authLimiter);

userRoutes.post(
  '/getSchool-profile',
  schoolScope,
  validator('getSchoolProfileSchema'),
  UserController.getSchoolProfile
);

userRoutes.get('/all-school-codes', UserController.getSchoolCodes);

userRoutes.get(
  '/get-profile',
  userAuth,
  schoolScope,
  UserController.getProfile
);
userRoutes.post(
  '/login',
  schoolScope,
  validator('userLoginSchema'),
  UserController.login
);

userRoutes.post(
  '/send-otp',
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
  '/change-password',
  userAuth,
  schoolScope,
  validator('changePasswordSchema'),
  UserController.changePassword
);

export default userRoutes;

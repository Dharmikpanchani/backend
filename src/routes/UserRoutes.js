import { Router } from 'express';
import * as UserController from '../controller/user/UserController.js';
import { userAuth, refreshTokenAuth } from '../middleware/Auth.js';
import { MediaUpload } from '../middleware/MediaUpload.js';
import { authLimiter } from '../middleware/RateLimit.js';

const userRoutes = Router();

// Apply strict rate limiting for auth endpoints
userRoutes.use('/signup', authLimiter);
userRoutes.use('/login', authLimiter);
userRoutes.use('/forgot-password', authLimiter);

//#region User authentication routes
userRoutes.post('/signup', UserController.createUser);
userRoutes.post('/verify-signup', UserController.verifySignup);

userRoutes.post('/login', UserController.login);
userRoutes.post('/verify-login-otp', UserController.verifyLoginOtp);

// Token Management
userRoutes.post(
  '/refresh-token',
  refreshTokenAuth,
  UserController.refreshToken
);
userRoutes.post('/logout', refreshTokenAuth, UserController.logout);

userRoutes.post('/forgot-password', UserController.forgotPassword);
userRoutes.post('/verify-password-otp', UserController.verifyOtpAction);
userRoutes.post('/reset-password', UserController.resetPassword);

// Protected Auth Routes
userRoutes.post('/change-password', userAuth, UserController.changePassword);
userRoutes.get('/profile', userAuth, UserController.profile);
userRoutes.post(
  '/update-profile',
  userAuth,
  MediaUpload(),
  UserController.updateProfile
);
//#endregion

export default userRoutes;

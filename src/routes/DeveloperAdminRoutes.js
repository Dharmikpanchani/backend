import { Router } from 'express';
import { validator } from '../middleware/Validator.js';
import * as DeveloperAdminController from '../controller/developerAdmin/DeveloperAdminController.js';
import * as DeveloperAuthController from '../controller/developerAdmin/DeveloperAuthController.js';
import * as DeveloperRolePermissionController from '../controller/developerAdmin/DeveloperRolePermissionController.js';
import * as SchoolController from '../controller/school/SchoolController.js';
import { developerAuth, refreshTokenAuth } from '../middleware/Auth.js';
import {
  checkPermission,
  checkRoleInUse,
  checkAdminInUse,
} from '../middleware/Rbac.js';
import { developerRolePermissionList } from '../utils/RolePermissionList.js';
import { authLimiter } from '../middleware/RateLimit.js';
import MediaUpload from '../middleware/MediaUpload.js';

const developerRoutes = Router();

//#region Auth & Profile Management
developerRoutes.use('/login', authLimiter);

developerRoutes.post(
  '/login',
  validator('developerLoginSchema'),
  DeveloperAuthController.login
);
developerRoutes.post(
  '/verify-otp',
  authLimiter,
  validator('developerVerifyOtpCommonSchema'),
  DeveloperAuthController.verifyOtpCommon
);

developerRoutes.post(
  '/re-send-otp',
  authLimiter,
  validator('developerSendOtpCommonSchema'),
  DeveloperAuthController.sendOtp
);

developerRoutes.post(
  '/refresh-token',
  refreshTokenAuth,
  DeveloperAuthController.refreshToken
);
developerRoutes.post(
  '/logout',
  refreshTokenAuth,
  DeveloperAuthController.logout
);

developerRoutes.post(
  '/forgot-password',
  validator('developerForgotPasswordSchema'),
  DeveloperAuthController.forgotPassword
);
developerRoutes.post(
  '/reset-password',
  validator('developerResetPasswordSchema'),
  DeveloperAuthController.resetPassword
);
developerRoutes.post(
  '/change-password',
  developerAuth,
  validator('changePasswordSchema'),
  DeveloperAuthController.changePassword
);

developerRoutes.get('/profile', developerAuth, DeveloperAuthController.profile);
developerRoutes.patch(
  '/update-profile',
  developerAuth,
  MediaUpload(),
  validator('developerUpdateProfileSchema'),
  DeveloperAuthController.updateProfile
);

developerRoutes.post(
  '/change-email-request',
  developerAuth,
  DeveloperAuthController.changeEmailRequest
);
developerRoutes.post(
  '/verify-email-change',
  developerAuth,
  DeveloperAuthController.verifyEmailChange
);
//#endregion

//#region Admin CRUD Management
developerRoutes.post(
  '/add-edit-admin',
  developerAuth,
  checkPermission(developerRolePermissionList.admin_user.create),
  DeveloperAdminController.addEditAdminProfile
);

developerRoutes.get(
  '/get-all-admins',
  developerAuth,
  checkPermission(developerRolePermissionList.admin_user.read),
  DeveloperAdminController.getAllAdmins
);

developerRoutes.get(
  '/get-admin/:id',
  developerAuth,
  checkPermission(developerRolePermissionList.admin_user.read),
  DeveloperAdminController.getAdminById
);

developerRoutes.delete(
  '/delete-admin/:id',
  developerAuth,
  checkPermission(developerRolePermissionList.admin_user.delete),
  checkAdminInUse,
  DeveloperAdminController.deleteAdmin
);

developerRoutes.post(
  '/admin-action-status/:id',
  developerAuth,
  checkPermission(developerRolePermissionList.admin_user.status),
  checkAdminInUse,
  DeveloperAdminController.adminStatusHandler
);
//#endregion

//#region Role Management routes
developerRoutes.post(
  '/add-edit-role',
  developerAuth,
  checkPermission(developerRolePermissionList.role.create),
  DeveloperRolePermissionController.addEditRole
);
developerRoutes.get(
  '/get-all-roles',
  developerAuth,
  checkPermission(developerRolePermissionList.role.read),
  DeveloperRolePermissionController.getAllRoles
);
developerRoutes.get(
  '/get-role/:id',
  developerAuth,
  checkPermission(developerRolePermissionList.role.read),
  DeveloperRolePermissionController.getRoleById
);
developerRoutes.delete(
  '/delete-role/:id',
  developerAuth,
  checkPermission(developerRolePermissionList.role.delete),
  checkRoleInUse,
  DeveloperRolePermissionController.deleteRole
);
//#endregion

//#region School CRUD Management
developerRoutes.post(
  '/add-edit-school',
  developerAuth,
  checkPermission(developerRolePermissionList.school.create),
  MediaUpload(),
  validator('schoolRegisterSchema'),
  SchoolController.addEditSchool
);

developerRoutes.get(
  '/get-all-schools',
  developerAuth,
  checkPermission(developerRolePermissionList.school.read),
  SchoolController.getAllSchools
);

developerRoutes.get(
  '/get-school/:schoolId',
  developerAuth,
  checkPermission(developerRolePermissionList.school.read),
  SchoolController.getSchoolById
);

developerRoutes.post(
  '/school-status/:schoolId',
  developerAuth,
  checkPermission(developerRolePermissionList.school.status),
  SchoolController.schoolStatusHandler
);

developerRoutes.delete(
  '/delete-school/:schoolId',
  developerAuth,
  checkPermission(developerRolePermissionList.school.delete),
  SchoolController.deleteSchool
);
//#endregion

export default developerRoutes;

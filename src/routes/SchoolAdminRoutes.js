import { Router } from 'express';
import { validator } from '../middleware/Validator.js';
import { MediaUpload } from '../middleware/MediaUpload.js';
import {
  adminAuth,
  refreshTokenAuth,
  schoolScope,
} from '../middleware/Auth.js';
import { authLimiter } from '../middleware/RateLimit.js';
import * as AdminController from '../controller/schoolAdmin/SchoolAdminController.js';
import * as RoleManagementController from '../controller/schoolAdmin/SchoolRolePermissionController.js';
import {
  checkPermission,
  checkRoleInUse,
  checkAdminInUse,
} from '../middleware/Rbac.js';
import { schoolAdminPermission } from '../utils/RolePermissionList.js';
import * as SchoolController from '../controller/school/SchoolController.js';
import * as DepartmentController from '../controller/schoolAdmin/teacher/DepartmentController.js';
import * as SubjectController from '../controller/schoolAdmin/teacher/SubjectController.js';
import * as ClassController from '../controller/schoolAdmin/teacher/ClassController.js';
import * as SectionController from '../controller/schoolAdmin/teacher/SectionController.js';
import * as TeacherController from '../controller/schoolAdmin/teacher/TeacherController.js';
import Teacher from '../models/teacher/Teacher.js';
import Subject from '../models/teacher/Subject.js';
import Section from '../models/teacher/Section.js';
import { responseMessage } from '../utils/ResponseMessage.js';
import { checkRecordInUse } from '../middleware/Rbac.js';

const adminRoutes = Router();

//#region Admin authentication routes
adminRoutes.use('/login', authLimiter);
adminRoutes.use('/register', authLimiter);
adminRoutes.use('/verify-otp', authLimiter);

adminRoutes.post(
  '/get-school-image',
  schoolScope,
  validator('getSchoolImageSchema'),
  SchoolController.getSchoolImageByCode
);

adminRoutes.get('/get-school-by-code', SchoolController.getSchoolByCode);

// Fully protected Root school Routes (RBAC Applied)
adminRoutes.get(
  '/school-profile',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.school_profile.read),
  SchoolController.getProfile
);
adminRoutes.post(
  '/school-update-profile',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.school_profile.update),
  MediaUpload(),
  validator('schoolUpdateProfileSchema'),
  SchoolController.updateProfile
);
adminRoutes.get(
  '/get-developer-wise-school-plan',
  adminAuth,
  schoolScope,
  SchoolController.getDeveloperWiseSchoolPlan
);
adminRoutes.post(
  '/update-school-theme',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.theme.update),
  SchoolController.updateSchoolTheme
);

adminRoutes.post(
  '/login',
  schoolScope,
  validator('adminLoginSchema'),
  AdminController.login
);
adminRoutes.post(
  '/verify-otp',
  authLimiter,
  schoolScope,
  validator('adminVerifyOtpCommonSchema'),
  AdminController.verifyOtpCommon
);

adminRoutes.post(
  '/add-edit-admin',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.admin_user.create),
  AdminController.addEditAdminProfile
);

adminRoutes.post(
  '/refresh-token',
  refreshTokenAuth,
  AdminController.refreshToken
);
adminRoutes.post('/logout', refreshTokenAuth, AdminController.logout);

adminRoutes.post(
  '/forgot-password',
  schoolScope,
  validator('adminForgotPasswordSchema'),
  AdminController.forgotPassword
);

adminRoutes.post(
  '/re-send-otp',
  authLimiter,
  schoolScope,
  validator('adminSendOtpCommonSchema'),
  AdminController.sendOtp
);

adminRoutes.post(
  '/reset-password',
  schoolScope,
  validator('adminResetPasswordSchema'),
  AdminController.resetPassword
);
adminRoutes.post(
  '/change-password',
  adminAuth,
  schoolScope,
  validator('changePasswordSchema'),
  AdminController.changePassword
);
adminRoutes.get('/profile', adminAuth, schoolScope, AdminController.profile);
adminRoutes.patch(
  '/update-profile',
  adminAuth,
  schoolScope,
  MediaUpload(),
  AdminController.updateProfile
);

adminRoutes.post(
  '/change-email-request',
  adminAuth,
  schoolScope,
  AdminController.changeEmailRequest
);
adminRoutes.post(
  '/verify-email-change',
  adminAuth,
  schoolScope,
  AdminController.verifyEmailChange
);

adminRoutes.get(
  '/get-all-admins',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.admin_user.read),
  AdminController.getAllAdmins
);

adminRoutes.get(
  '/get-admin/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.admin_user.read),
  AdminController.getAdminById
);
adminRoutes.delete(
  '/delete-admin/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.admin_user.delete),
  checkAdminInUse,
  AdminController.deleteAdmin
);
adminRoutes.post(
  '/admin-action-status/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.admin_user.status),
  checkAdminInUse,
  AdminController.adminStatusHandler
);
//#endregion

//#region Role Management routes
adminRoutes.post(
  '/add-edit-role',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.role.create),
  RoleManagementController.addEditRole
);
adminRoutes.get(
  '/get-all-roles',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.role.read),
  RoleManagementController.getAllRoles
);
adminRoutes.get(
  '/get-role/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.role.read),
  RoleManagementController.getRoleById
);
adminRoutes.delete(
  '/delete-role/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.role.delete),
  checkRoleInUse,
  RoleManagementController.deleteRole
);
//#endregion

//#region Master Modules (Department, Subject, Class, Section)
adminRoutes.post(
  '/add-edit-department',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.department.create),
  DepartmentController.addEditDepartment
);
adminRoutes.get(
  '/departments',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.department.read),
  DepartmentController.getDepartments
);
adminRoutes.get(
  '/get-department/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.department.read),
  DepartmentController.getDepartmentById
);
adminRoutes.delete(
  '/departments/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.department.delete),
  checkRecordInUse([
    {
      model: Teacher,
      field: 'departmentId',
      message: responseMessage.DEPARTMENT_IN_USE_DELETE,
    },
    {
      model: Subject,
      field: 'departmentIds',
      message: responseMessage.DEPARTMENT_IN_USE_DELETE,
    },
  ]),
  DepartmentController.deleteDepartment
);
adminRoutes.post(
  '/department-action-status/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.department.status),
  checkRecordInUse([
    {
      model: Teacher,
      field: 'departmentId',
      message: responseMessage.DEPARTMENT_IN_USE_STATUS,
    },
    {
      model: Subject,
      field: 'departmentIds',
      message: responseMessage.DEPARTMENT_IN_USE_STATUS,
    },
  ]),
  DepartmentController.departmentStatusHandler
);

adminRoutes.post(
  '/add-edit-subject',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.subject.create),
  SubjectController.addEditSubject
);
adminRoutes.get(
  '/subjects',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.subject.read),
  SubjectController.getSubjects
);
adminRoutes.get(
  '/get-subject/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.subject.read),
  SubjectController.getSubjectById
);
adminRoutes.delete(
  '/subjects/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.subject.delete),
  checkRecordInUse([
    {
      model: Teacher,
      field: 'subjects',
      message: responseMessage.SUBJECT_IN_USE_DELETE,
    },
  ]),
  SubjectController.deleteSubject
);
adminRoutes.post(
  '/subject-action-status/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.subject.status),
  checkRecordInUse([
    {
      model: Teacher,
      field: 'subjects',
      message: responseMessage.SUBJECT_IN_USE_STATUS,
    },
  ]),
  SubjectController.subjectStatusHandler
);

adminRoutes.post(
  '/add-edit-class',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.class.create),
  ClassController.addEditClass
);
adminRoutes.get(
  '/classes',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.class.read),
  ClassController.getClasses
);
adminRoutes.get(
  '/get-class/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.class.read),
  ClassController.getClassById
);
adminRoutes.delete(
  '/classes/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.class.delete),
  checkRecordInUse([
    {
      model: Section,
      field: 'classId',
      message: responseMessage.CLASS_IN_USE_DELETE,
    },
    {
      model: Teacher,
      field: 'classesAssigned',
      message: responseMessage.CLASS_IN_USE_DELETE,
    },
  ]),
  ClassController.deleteClass
);
adminRoutes.post(
  '/class-action-status/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.class.status),
  checkRecordInUse([
    {
      model: Section,
      field: 'classId',
      message: responseMessage.CLASS_IN_USE_STATUS,
    },
    {
      model: Teacher,
      field: 'classesAssigned',
      message: responseMessage.CLASS_IN_USE_STATUS,
    },
  ]),
  ClassController.classStatusHandler
);

adminRoutes.post(
  '/add-edit-section',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.section.create),
  SectionController.addEditSection
);
adminRoutes.get(
  '/sections',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.section.read),
  SectionController.getSections
);
adminRoutes.get(
  '/get-section/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.section.read),
  SectionController.getSectionById
);
adminRoutes.delete(
  '/sections/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.section.delete),
  checkRecordInUse([
    {
      model: Teacher,
      field: 'sectionsAssigned',
      message: responseMessage.SECTION_IN_USE_DELETE,
    },
  ]),
  SectionController.deleteSection
);
adminRoutes.post(
  '/section-action-status/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.section.status),
  checkRecordInUse([
    {
      model: Teacher,
      field: 'sectionsAssigned',
      message: responseMessage.SECTION_IN_USE_STATUS,
    },
  ]),
  SectionController.sectionStatusHandler
);
//#endregion

//#region Teacher Module
adminRoutes.post(
  '/add-edit-teacher',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.teacher.create),
  MediaUpload(),
  TeacherController.addEditTeacher
);
adminRoutes.post(
  '/add-edit-teacher/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.teacher.update),
  MediaUpload(),
  TeacherController.addEditTeacher
);
adminRoutes.get(
  '/get-all-teachers',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.teacher.read),
  TeacherController.getTeachers
);
adminRoutes.get(
  '/get-teacher/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.teacher.read),
  TeacherController.getTeacherById
);
adminRoutes.delete(
  '/delete-teacher/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.teacher.delete),
  TeacherController.deleteTeacher
);
adminRoutes.post(
  '/teacher-action-status/:id',
  adminAuth,
  schoolScope,
  checkPermission(schoolAdminPermission.teacher.status),
  TeacherController.teacherStatusHandler
);
//#endregion

export default adminRoutes;

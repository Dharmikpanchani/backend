import { StatusCodes } from 'http-status-codes';
import { responseMessage } from '../utils/ResponseMessage.js';
import Logger from '../utils/Logger.js';
import User from '../models/user/User.js';
import Teacher from '../models/teacher/Teacher.js';
import Student from '../models/student/Student.js';
import Admin from '../models/common/Admin.js';
import School from '../models/school/School.js';
import { verifyToken } from '../services/TokenService.js';
import {
  CatchErrorHandler,
  ResponseHandler,
} from '../services/CommonServices.js';
import config from '../config/Index.js';

const logger = new Logger('src/middleware/Auth.js');

//#region Extract Token Helper
const extractToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return req.headers.authorization.split(' ')[1];
  }
  return req.headers['auth'];
};
//#endregion

//#region User Auth Middleware (Access Token)
export const userAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.TOKEN_REQUIRED
      );
    }

    const decodeToken = verifyToken(token, config.JWT_SECRET_KEY);
    if (!decodeToken || !decodeToken.id) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_TOKEN
      );
    }

    const userIdentity = await User.findById(decodeToken.id);
    if (!userIdentity) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_NOT_FOUND
      );
    }

    if (userIdentity.isDeleted) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.USER_ACCOUNT_DELETED
      );
    }
    if (!userIdentity.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.USER_NOT_ACTIVE
      );
    }
    if (!userIdentity.isLogin) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        'Your session has expired. Please log in again.'
      );
    }

    let userProfile;
    if (userIdentity.userType === config.TEACHER) {
      userProfile = await Teacher.findById(userIdentity.teacherId);
    } else if (userIdentity.userType === config.STUDENT) {
      userProfile = await Student.findById(userIdentity.studentId);
    }

    if (!userProfile) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.USER_PROFILE_NOT_FOUND
      );
    }

    req.user_id = userProfile._id;
    req.user = userProfile;
    req.school_id = userIdentity.schoolId;
    req.userType = userIdentity.userType;
    req.userIdentity = userIdentity;
    req.identityId = userIdentity._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.ACCESS_TOKEN_HAS_EXPIRED
      );
    }
    if (error.name === 'JsonWebTokenError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_ACCESS_TOKEN
      );
    }
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region SchoolAdmin Auth Middleware (Access Token)
export const adminAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.TOKEN_REQUIRED
      );
    }

    const decodeToken = verifyToken(token, config.JWT_SECRET_KEY);
    if (!decodeToken || !decodeToken.id) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_TOKEN
      );
    }

    const admin = await Admin.findOne({
      _id: decodeToken.id,
      isDeleted: false,
      type: config.SCHOOL_ADMIN,
    });
    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    if (!admin.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ADMIN_ACCOUNT_IS_DISABLED
      );
    }
    if (!admin.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_NOT_VERIFIED_PLEASE_VERIFY_OTP
      );
    }
    if (!admin.isLogin) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.SESSION_EXPIRED
      );
    }

    // ✅ IMPORTANT CHANGE
    req.admin_id = admin._id;
    req.school_id = admin.schoolId; // 🔥 ADD THIS
    req.admin = admin;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.ACCESS_TOKEN_HAS_EXPIRED
      );
    }
    if (error.name === 'JsonWebTokenError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_ACCESS_TOKEN
      );
    }
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region DeveloperAdmin Auth Middleware (Access Token)
export const developerAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.TOKEN_REQUIRED
      );
    }

    const decodeToken = verifyToken(token, config.JWT_SECRET_KEY);
    if (!decodeToken || !decodeToken.id) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_TOKEN
      );
    }

    // Dynamic import to avoid circular dependency if any, though regular import is better.
    // We already have standard imports at the top. We will just use the model.
    const developer = await Admin.findOne({
      _id: decodeToken.id,
      isDeleted: false,
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
    });
    if (!developer) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEVELOPER_NOT_FOUND
      );
    }

    if (!developer.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.DEVELOPER_ACCOUNT_IS_DISABLED
      );
    }
    if (!developer.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ACCOUNT_NOT_VERIFIED_PLEASE_VERIFY_OTP
      );
    }
    if (!developer.isLogin) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.SESSION_EXPIRED
      );
    }

    req.developer_id = developer._id;
    req.developer = developer;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.ACCESS_TOKEN_HAS_EXPIRED
      );
    }
    if (error.name === 'JsonWebTokenError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_ACCESS_TOKEN
      );
    }
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Refresh Token Auth Middleware (Cookie)
export const refreshTokenAuth = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      logger.info('Refresh token missing from cookies');
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.REFRESH_TOKEN_REQUIRED_STRING
      );
    }

    const decodeToken = verifyToken(refreshToken, config.JWT_REFRESH_SECRET);
    if (!decodeToken || !decodeToken.id) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.INVALID_REFRESH_TOKEN
      );
    }

    // Attach decoded data to request
    req.token_id = decodeToken.id;
    req.token_type = decodeToken.type; // e.g., 'admin', 'user', 'school'
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.REFRESH_TOKEN_HAS_EXPIRED_PLEASE_LOG_IN_
      );
    }
    logger.error('Refresh Token Error: ', error.message);
    return ResponseHandler(
      res,
      StatusCodes.UNAUTHORIZED,
      responseMessage.INVALID_REFRESH_TOKEN
    );
  }
};
//#endregion

//#region School Scope Middleware
export const schoolScope = async (req, res, next) => {
  try {
    let schoolId = req.school_id || req.body?.school_id || req.query?.school_id;
    let schoolCode =
      req.body?.schoolCode || req.query?.schoolCode || req.params?.schoolCode;

    let school = null;

    // 🔹 Case 1: Resolve by schoolCode
    if (!schoolId && schoolCode) {
      school = await School.findOne({
        schoolCode,
        isDeleted: false,
      });
      if (!school) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SCHOOL_NOT_FOUND
        );
      }

      schoolId = school._id;
    }

    // 🔹 Case 2: Resolve by schoolId
    if (!school && schoolId) {
      school = await School.findOne({
        _id: schoolId,
      });

      if (!school) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SCHOOL_NOT_FOUND_FOR_ID
        );
      }
    }

    // 🔹 Case 3: Missing context
    if (!schoolId) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.SCHOOL_CONTEXT_MISSING
      );
    }

    // 🔥 Business Rules
    if (!school.isActive) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.SCHOOL_ACCOUNT_INACTIVE
      );
    }

    if (!school.isVerified) {
      // 1. Always allow logo fetch for identification
      const isGetSchoolImage = req.originalUrl.includes('/get-school-image');

      if (!isGetSchoolImage) {
        // 2. Allow bypass ONLY if it's a Super Admin
        const email = req.body?.email || req.query?.email;
        const adminId = req.admin_id;

        let isSuperAdmin = false;

        if (adminId) {
          isSuperAdmin = req.admin?.isSuperAdmin;
        } else if (email) {
          const admin = await Admin.findOne({
            email,
            schoolId: school._id,
            isDeleted: false,
          });
          isSuperAdmin = admin?.isSuperAdmin || false;
        }

        if (!isSuperAdmin) {
          return ResponseHandler(
            res,
            StatusCodes.BAD_REQUEST,
            responseMessage.SCHOOL_ACCOUNT_NOT_VERIFIED
          );
        }
      }
    }

    // ✅ Inject into request
    req.school_id = schoolId;
    req.school = school;
    req.developer_id = school.referralId;

    req.schoolFilter = {
      schoolId,
      isDeleted: false,
    };

    next();
  } catch (error) {
    // 🔥 Specific error handling
    if (error.name === 'CastError') {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.INVALID_SCHOOL_ID_FORMAT
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      responseMessage.ERROR_RESOLVING_SCHOOL
    );
  }
};
//#endregion

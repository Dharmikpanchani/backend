import { StatusCodes } from 'http-status-codes';
import {
  ResponseHandler,
  CatchErrorHandler,
} from '../services/CommonServices.js';
import User from '../models/user/User.js';
import Admin from '../models/common/Admin.js';
import School from '../models/school/School.js';
import { responseMessage } from '../utils/ResponseMessage.js';

import Logger from '../utils/Logger.js';
import config from '../config/Index.js';
const logger = new Logger('Rbac.js');

import redis from '../config/Redis.config.js';

//#region Check Permission Middleware
/**
 * Middleware to check if the user/admin has the required permission
 * @param {string} requiredPermission - The required permission string (e.g., schoolAdminPermission.users.create)
 */
export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (req.query?.type === 'filter') {
        return next();
      }
      // Admins attached to req.admin, Users to req.user, Developers to req.developer
      const userOrAdmin = req.admin || req.user || req.developer;

      // Ensure the user/admin/developer was properly loaded
      if (!userOrAdmin) {
        return ResponseHandler(
          res,
          StatusCodes.UNAUTHORIZED,
          responseMessage.AUTHENTICATION_REQUIRED
        );
      }

      // Identifier for rate limiting/blocking (use Admin/User ID)
      const userId = userOrAdmin._id?.toString();

      // 🔹 Check if user is temporarily blocked due to repeated plan violations
      if (userId) {
        try {
          const isBlocked = await redis.get(`plan_blocked:${userId}`);
          if (isBlocked) {
            return ResponseHandler(
              res,
              StatusCodes.FORBIDDEN,
              responseMessage.PLAN_VIOLATION_BLOCKED
            );
          }
        } catch (error) {
          logger.warn(`Redis block check failed: ${error.message}`);
        }
      }

      // If user is a super admin or super developer, bypass checks
      if (
        userOrAdmin?.type == config.SUPER_ADMIN ||
        userOrAdmin?.isSuperAdmin ||
        req.developer
      ) {
        return next();
      }

      // 🔹 Check Plan Based Permission if school context exists
      if (req.school_id) {
        if (!req.school) {
          req.school = await School.findById(req.school_id).populate("planId");
        } else if (!req.school.populated("planId")) {
          await req.school.populate("planId");
        }

        const planPermissions = req.school?.planId?.permissions || [];
        if (!planPermissions.includes(requiredPermission)) {
          // 🔹 Record Violation
          if (userId) {
            try {
              const violations = await redis.incr(`plan_violations:${userId}`);
              if (violations === 1) {
                // Set TTL for violations counter (24 hours window to hit the limit)
                await redis.expire(`plan_violations:${userId}`, 86400);
              }

              if (violations >= 15) {
                // Block user for 3 hours (10800 seconds)
                await redis.set(`plan_blocked:${userId}`, 'true', 'EX', 10800);
                await redis.del(`plan_violations:${userId}`);

                return ResponseHandler(
                  res,
                  StatusCodes.FORBIDDEN,
                  responseMessage.PLAN_VIOLATION_BLOCKED
                );
              }
            } catch (error) {
              logger.warn(`Redis violation tracking failed: ${error.message}`);
            }
          }

          return ResponseHandler(
            res,
            StatusCodes.FORBIDDEN,
            responseMessage.PLAN_PERMISSION_DENIED
          );
        }
      }

      // Populate Role if not already populated
      if (!userOrAdmin?.populated('role')) {
        await userOrAdmin?.populate('role');
      }

      const role = userOrAdmin?.role;

      if (!role?.isActive) {
        return ResponseHandler(
          res,
          StatusCodes.FORBIDDEN,
          responseMessage.ACCESS_DENIED_ROLE_IS_INACTIVE
        );
      }

      const hasExactPermission =
        role?.permissions?.includes(requiredPermission);

      if (hasExactPermission) {
        return next();
      }

      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.ACCESS_DENIED_REQUIRES_REQUIREDPERMISSIO
      );
    } catch (error) {
      logger.error(error);
      return ResponseHandler(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        responseMessage.ERROR_CHECKING_PERMISSIONS
      );
    }
  };
};
//#endregion

//#region Check Role In Use Middleware
export const checkRoleInUse = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ROLE_ID_IS_REQUIRED
      );
    }

    const adminExists = await Admin.exists({
      role: id,
      isDeleted: false,
    });
    if (adminExists) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.ROLE_IS_ASSIGNED_TO_ADMINS ||
        'Role is assigned to admins'
      );
    }

    const userExists = await User.exists({ role: id, isDeleted: false });
    if (userExists) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.ROLE_IS_ASSIGNED_TO_USERS
      );
    }

    next();
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Check Admin In Use Middleware
export const checkAdminInUse = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        'Admin ID is required'
      );
    }

    const schoolInUse = await School.exists({
      referralId: id,
      isDeleted: false,
    });

    if (schoolInUse) {
      return ResponseHandler(
        res,
        StatusCodes.CONFLICT,
        responseMessage.ADMIN_IN_USE
      );
    }

    next();
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion
//#region Check Record In Use Middleware
/**
 * Generic middleware to check if a record is in use by other models
 * @param {Array} checkConfigs - Array of objects { model: MongooseModel, field: string, message: string }
 */
export const checkRecordInUse = (checkConfigs) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        return ResponseHandler(res, StatusCodes.BAD_REQUEST, 'ID is required');
      }

      for (const config of checkConfigs) {
        const query = { [config.field]: id, isDeleted: false };

        // Add school filter if type check is requested and present
        if (req?.schoolFilter) {
          Object.assign(query, req.schoolFilter);
        }

        const inUse = await config.model.exists(query);

        if (inUse) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            config.message ||
            'Record is currently in use and cannot be modified or deleted.'
          );
        }
      }

      next();
    } catch (error) {
      logger.error(error);
      return CatchErrorHandler(res, error);
    }
  };
};
//#endregion

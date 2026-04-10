import RoleManagement from '../../models/common/RolePermission.js';
import { StatusCodes } from 'http-status-codes';
import {
  ResponseHandler,
  CatchErrorHandler,
  queryBuilder,
} from '../../services/CommonServices.js';
import { responseMessage } from '../../utils/ResponseMessage.js';
import Logger from '../../utils/Logger.js';
import Admin from '../../models/common/Admin.js';

const logger = new Logger(
  'src/controller/developerAdmin/DeveloperRolePermissionController.js'
);

//#region Add / Edit Role
export const addEditRole = async (req, res) => {
  try {
    const { id, role, permissions } = req.body;
    let parsedPermissions = permissions;

    if (typeof permissions === 'string') {
      try {
        parsedPermissions = JSON.parse(permissions);
      } catch (error) {
        logger.error(error);
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.PERMISSIONS_MUST_BE_A_VALID_JSON_ARRAY
        );
      }
    }

    if (!Array.isArray(parsedPermissions)) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PERMISSIONS_MUST_BE_AN_ARRAY
      );
    }

    let result;

    if (id) {
      const existingRole = await RoleManagement.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!existingRole) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.ROLE_NOT_FOUND
        );
      }

      const payload = {
        permissions: parsedPermissions,
      };

      if (role) {
        payload.role = role.trim();
      }

      if (payload.role) {
        const duplicate = await RoleManagement.findOne({
          _id: { $ne: id },
          role: payload.role,
          schoolId: null,
          isDeleted: false,
        });

        if (duplicate) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.ROLE_ALREADY_EXISTS
          );
        }
      }

      result = await RoleManagement.findByIdAndUpdate(id, payload, {
        new: true,
      });
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.ROLE_UPDATED,
        result
      );
    } else {
      const payload = {
        role: role?.trim(),
        permissions: parsedPermissions,
        schoolId: null, // Global roles
        createdBy: req?.developer_id,
      };

      const duplicate = await RoleManagement.findOne({
        role: payload.role,
        schoolId: null,
        isDeleted: false,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ROLE_ALREADY_EXISTS
        );
      }

      // ✅ Check if a soft-deleted role exists with the same name.
      // If so, restore it instead of inserting a new document to avoid
      // the unique index conflict on (role, schoolId).
      const deletedRole = await RoleManagement.findOne({
        role: payload.role,
        schoolId: null,
        isDeleted: true,
      });

      if (deletedRole) {
        result = await RoleManagement.findByIdAndUpdate(
          deletedRole._id,
          { ...payload, isDeleted: false, isActive: true },
          { new: true }
        );
      } else {
        result = await RoleManagement.create(payload);
      }
      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.ROLE_ADDED,
        result
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Get All Roles
export const getAllRoles = async (req, res) => {
  try {
    const { pageNumber, perPageData, searchRequest, isActive, type } =
      req.query;

    const result = await queryBuilder(RoleManagement, {
      pageNumber: type ? 1 : pageNumber,
      perPageData: type ? Number.MAX_SAFE_INTEGER : perPageData,
      searchRequest,

      searchableFields: ['role'],
      sort: { createdAt: -1 },

      filters: {
        schoolId: null,
        isActive,
      },
    });

    const data = type
      ? { data: result.data }
      : {
          pagination: result.pagination,
          data: result.data,
        };

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ROLE_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Get Role By ID
export const getRoleById = async (req, res) => {
  try {
    const data = await RoleManagement.findOne({
      _id: req.params.id,
      schoolId: null,
      isDeleted: false,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ROLE_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ROLE_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Delete Role (Soft Delete)
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role is bound to any global/tenant admins
    const isRoleInUse = await Admin.exists({ role: id, isDeleted: false });
    if (isRoleInUse) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ROLE_ASSIGNED_TO_USER_DELETE
      );
    }

    const data = await RoleManagement.findOne({
      _id: id,
      schoolId: null,
      isDeleted: false,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ROLE_NOT_FOUND
      );
    }

    // ✅ Scramble the role name to free the unique index slot (role, schoolId).
    // This allows the same role name to be re-created later without an E11000 error.
    const scrambledRole = `${data.role}_deleted_${Date.now()}`;
    await RoleManagement.findByIdAndUpdate(data._id, {
      isDeleted: true,
      role: scrambledRole,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ROLE_DELETE_SUCCESS,
      null
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

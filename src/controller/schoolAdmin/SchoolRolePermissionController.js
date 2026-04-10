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

const logger = new Logger('src/controllers/roleManagement.controller.js');

//#region ➕ Add / ✏️ Edit Role
export const addEditRole = async (req, res) => {
  try {
    const { id, role, permissions } = req.body;
    let parsedPermissions = permissions;

    // Parse permissions if string
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

    // Validate parsedPermissions is an array
    if (!Array.isArray(parsedPermissions)) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.PERMISSIONS_MUST_BE_AN_ARRAY
      );
    }

    const assignedSchoolId = req?.school_id;
    // Build payload
    const payload = {
      role: role?.trim(),
      permissions: parsedPermissions,
      schoolId: assignedSchoolId,
      createdBy: req?.admin_id,
    };

    let result;

    if (id) {
      // 🔹 Update flow
      const existingRole = await RoleManagement.findOne({
        _id: id,
        ...req?.schoolFilter,
      });

      if (!existingRole) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.ROLE_NOT_FOUND
        );
      }

      const duplicate = await RoleManagement.findOne({
        _id: { $ne: id },
        role: payload.role,
        ...req?.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ROLE_ALREADY_EXISTS
        );
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
      // 🔹 Create flow — check active roles first
      const duplicate = await RoleManagement.findOne({
        role: payload.role,
        ...req?.schoolFilter,
        isDeleted: false,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ROLE_ALREADY_EXISTS
        );
      }

      // ✅ Check if a soft-deleted role exists with the same name + schoolId.
      // If so, restore it instead of inserting a new document to avoid
      // the unique index conflict on (role, schoolId).
      const deletedRole = await RoleManagement.findOne({
        role: payload.role,
        schoolId: assignedSchoolId,
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

//#region 📄 Get All Roles
export const getAllRoles = async (req, res) => {
  try {
    const { pageNumber, perPageData, searchRequest, isActive, type } =
      req?.query || {};

    const result = await queryBuilder(RoleManagement, {
      pageNumber: type ? 1 : pageNumber,
      perPageData: type ? Number.MAX_SAFE_INTEGER : perPageData,
      searchRequest,
      searchableFields: ['role'],
      booleanFields: ['isActive'],
      sort: { createdAt: -1 },
      filters: {
        ...req?.schoolFilter,
        isActive: type ? true : isActive,
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

//#region 🔍 Get Role By ID
export const getRoleById = async (req, res) => {
  try {
    const data = await RoleManagement.findOne({
      _id: req.params.id,
      ...req?.schoolFilter,
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

//#region 🗑️ Delete Role (Soft Delete)
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 Check if role is in use BEFORE deleting
    const isRoleInUse = await Admin.exists({
      role: id,
      ...req?.schoolFilter,
      isDeleted: false,
    });
    if (isRoleInUse) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.ROLE_ASSIGNED_TO_USER_DELETE
      );
    }

    const data = await RoleManagement.findOne({
      _id: id,
      ...req?.schoolFilter,
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

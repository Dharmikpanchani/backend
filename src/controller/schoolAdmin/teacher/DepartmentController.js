import { StatusCodes } from 'http-status-codes';
import Department from '../../../models/teacher/Department.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  queryBuilder,
} from '../../../services/CommonServices.js';
import { responseMessage } from '../../../utils/ResponseMessage.js';
import Logger from '../../../utils/Logger.js';

const logger = new Logger(
  './src/controller/schoolAdmin/teacher/DepartmentController.js'
);

//#region ➕ Add / ✏️ Edit Department
export const addEditDepartment = async (req, res) => {
  try {
    const { id, name, code } = req.body;
    const schoolId = req.school_id;

    const payload = {
      name: name?.trim(),
      code: code?.trim(),
      schoolId,
    };

    if (id) {
      // 🔹 Update flow
      const existingDepartment = await Department.findOne({
        _id: id,
        ...req.schoolFilter,
      });

      if (!existingDepartment) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.DEPARTMENT_NOT_FOUND
        );
      }

      const duplicate = await Department.findOne({
        _id: { $ne: id },
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.DEPARTMENT_ALREADY_EXISTS
        );
      }

      const result = await Department.findByIdAndUpdate(id, payload, {
        new: true,
      });

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.DEPARTMENT_UPDATED,
        result
      );
    } else {
      // 🔹 Create flow
      const duplicate = await Department.findOne({
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.DEPARTMENT_ALREADY_EXISTS
        );
      }

      // Check for soft-deleted one to restore
      const deletedDept = await Department.findOne({
        $or: [{ code: payload.code }, { name: payload.name }],
        schoolId,
        isDeleted: true,
      });

      let result;
      if (deletedDept) {
        result = await Department.findByIdAndUpdate(
          deletedDept._id,
          { ...payload, isDeleted: false, isActive: true },
          { new: true }
        );
      } else {
        result = await Department.create(payload);
      }

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.DEPARTMENT_ADDED,
        result
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get Departments
export const getDepartments = async (req, res) => {
  try {
    const { pageNumber, perPageData, searchRequest, isActive, type } =
      req?.query || {};

    const filters = {
      ...req.schoolFilter,
      isActive: type ? true : isActive,
    };

    const result = await queryBuilder(Department, {
      pageNumber: type ? 1 : pageNumber,
      perPageData: type ? Number.MAX_SAFE_INTEGER : perPageData,
      searchRequest,
      searchableFields: ['name', 'code'],
      booleanFields: ['isActive'],
      sort: { createdAt: -1 },
      filters,
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
      responseMessage.DEPARTMENT_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Department
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await Department.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEPARTMENT_NOT_FOUND
      );
    }

    // ✅ Scramble the code/name to free the unique index slot if needed
    const scrambledCode = `${data.code}_deleted_${Date.now()}`;
    const scrambledName = `${data.name}_deleted_${Date.now()}`;
    await Department.findByIdAndUpdate(data._id, {
      isDeleted: true,
      code: scrambledCode,
      name: scrambledName,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.DEPARTMENT_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔍 Get Department By ID
export const getDepartmentById = async (req, res) => {
  try {
    const data = await Department.findOne({
      _id: req.params.id,
      ...req.schoolFilter,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEPARTMENT_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.DEPARTMENT_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚙️ Update Department Status
export const departmentStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!department) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.DEPARTMENT_NOT_FOUND
      );
    }

    const updatedDepartment = await Department.findByIdAndUpdate(
      id,
      { isActive: !department.isActive },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.DEPARTMENT_STATUS_UPDATED,
      updatedDepartment
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

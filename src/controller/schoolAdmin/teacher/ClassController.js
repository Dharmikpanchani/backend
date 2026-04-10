import { StatusCodes } from 'http-status-codes';
import Class from '../../../models/teacher/Class.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  queryBuilder,
} from '../../../services/CommonServices.js';
import { responseMessage } from '../../../utils/ResponseMessage.js';
import Logger from '../../../utils/Logger.js';

const logger = new Logger(
  './src/controller/schoolAdmin/teacher/ClassController.js'
);

//#region ➕ Add / ✏️ Edit Class
export const addEditClass = async (req, res) => {
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
      const existingClass = await Class.findOne({
        _id: id,
        ...req.schoolFilter,
      });

      if (!existingClass) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.CLASS_NOT_FOUND
        );
      }

      const duplicate = await Class.findOne({
        _id: { $ne: id },
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.CLASS_ALREADY_EXISTS
        );
      }

      const result = await Class.findByIdAndUpdate(id, payload, {
        new: true,
      });

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.CLASS_UPDATED,
        result
      );
    } else {
      // 🔹 Create flow
      const duplicate = await Class.findOne({
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.CLASS_ALREADY_EXISTS
        );
      }

      // Check for soft-deleted one to restore
      const deletedClass = await Class.findOne({
        $or: [{ code: payload.code }, { name: payload.name }],
        schoolId,
        isDeleted: true,
      });

      let result;
      if (deletedClass) {
        result = await Class.findByIdAndUpdate(
          deletedClass._id,
          { ...payload, isDeleted: false, isActive: true },
          { new: true }
        );
      } else {
        result = await Class.create(payload);
      }

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.CLASS_ADDED,
        result
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get Classes
export const getClasses = async (req, res) => {
  try {
    const { pageNumber, perPageData, searchRequest, isActive, type } =
      req?.query || {};

    const filters = {
      ...req.schoolFilter,
      isActive: type ? true : isActive,
    };

    const result = await queryBuilder(Class, {
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
      responseMessage.CLASS_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Class
export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await Class.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.CLASS_NOT_FOUND
      );
    }

    // ✅ Scramble the code/name to free the unique index slot if needed
    const scrambledCode = `${data.code}_deleted_${Date.now()}`;
    const scrambledName = `${data.name}_deleted_${Date.now()}`;
    await Class.findByIdAndUpdate(data._id, {
      isDeleted: true,
      code: scrambledCode,
      name: scrambledName,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.CLASS_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔍 Get Class By ID
export const getClassById = async (req, res) => {
  try {
    const data = await Class.findOne({
      _id: req.params.id,
      ...req.schoolFilter,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.CLASS_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.CLASS_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚙️ Update Class Status
export const classStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const classData = await Class.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!classData) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.CLASS_NOT_FOUND
      );
    }

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { isActive: !classData.isActive },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.CLASS_STATUS_UPDATED,
      updatedClass
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

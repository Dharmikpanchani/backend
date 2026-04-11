import { StatusCodes } from 'http-status-codes';
import Subject from '../../../models/teacher/Subject.js';
import Department from '../../../models/teacher/Department.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  queryBuilder,
} from '../../../services/CommonServices.js';
import { responseMessage } from '../../../utils/ResponseMessage.js';
import Logger from '../../../utils/Logger.js';

const logger = new Logger(
  './src/controller/schoolAdmin/teacher/SubjectController.js'
);

//#region ➕ Add / ✏️ Edit Subject
export const addEditSubject = async (req, res) => {
  try {
    const { id, name, code, departmentIds } = req.body;
    const schoolId = req.school_id;

    const payload = {
      name: name?.trim(),
      code: code?.trim(),
      departmentIds,
      schoolId,
    };

    if (id) {
      // 🔹 Update flow
      const existingSubject = await Subject.findOne({
        _id: id,
        ...req.schoolFilter,
      });

      if (!existingSubject) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SUBJECT_NOT_FOUND
        );
      }

      const duplicate = await Subject.findOne({
        _id: { $ne: id },
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.SUBJECT_ALREADY_EXISTS
        );
      }

      const result = await Subject.findByIdAndUpdate(id, payload, {
        new: true,
      }).populate([{ path: 'departmentIds', select: 'name code' }]);

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.SUBJECT_UPDATED,
        result
      );
    } else {
      // 🔹 Create flow
      const duplicate = await Subject.findOne({
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.SUBJECT_ALREADY_EXISTS
        );
      }

      // Check for soft-deleted one to restore
      const deletedSubject = await Subject.findOne({
        $or: [{ code: payload.code }, { name: payload.name }],
        schoolId,
        isDeleted: true,
      });

      let result;
      if (deletedSubject) {
        result = await Subject.findByIdAndUpdate(
          deletedSubject._id,
          { ...payload, isDeleted: false, isActive: true },
          { new: true }
        ).populate([{ path: 'departmentIds', select: 'name code' }]);
      } else {
        result = await Subject.create(payload);
        await result.populate([{ path: 'departmentIds', select: 'name code' }]);
      }

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.SUBJECT_ADDED,
        result
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get Subjects
export const getSubjects = async (req, res) => {
  try {
    const {
      departmentIds,
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      type,
    } = req?.query || {};

    const filters = {
      ...req.schoolFilter,
    };

    if (type) {
      filters.isActive = true;
    } else if (isActive !== undefined && isActive !== '') {
      filters.isActive = isActive;
    }

    if (departmentIds) {
      filters.departmentIds = {
        $in: Array.isArray(departmentIds) ? departmentIds : [departmentIds],
      };
    }

    let extraOrConditions = [];
    if (searchRequest) {
      const matchingDepartments = await Department.find({
        name: { $regex: searchRequest, $options: 'i' },
        ...req.schoolFilter,
      }).select('_id');

      if (matchingDepartments.length > 0) {
        extraOrConditions.push({
          departmentIds: { $in: matchingDepartments.map((d) => d._id) },
        });
      }
    }

    const result = await queryBuilder(Subject, {
      pageNumber: type ? 1 : pageNumber,
      perPageData: type ? Number.MAX_SAFE_INTEGER : perPageData,
      searchRequest,
      searchableFields: ['name', 'code'],
      extraOrConditions,
      booleanFields: ['isActive'],
      sort: { createdAt: -1 },
      filters,
      populate: [{ path: 'departmentIds', select: 'name code' }],
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
      responseMessage.SUBJECT_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Subject
export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await Subject.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SUBJECT_NOT_FOUND
      );
    }

    // ✅ Scramble the code/name to free the unique index slot if needed
    const scrambledCode = `${data.code}_deleted_${Date.now()}`;
    const scrambledName = `${data.name}_deleted_${Date.now()}`;
    await Subject.findByIdAndUpdate(data._id, {
      isDeleted: true,
      code: scrambledCode,
      name: scrambledName,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SUBJECT_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔍 Get Subject By ID
export const getSubjectById = async (req, res) => {
  try {
    const data = await Subject.findOne({
      _id: req.params.id,
      ...req.schoolFilter,
    }).populate([{ path: 'departmentIds', select: 'name code' }]);

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SUBJECT_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SUBJECT_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚙️ Update Subject Status
export const subjectStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!subject) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SUBJECT_NOT_FOUND
      );
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { isActive: !subject.isActive },
      { new: true }
    ).populate([{ path: 'departmentIds', select: 'name code' }]);

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SUBJECT_STATUS_UPDATED,
      updatedSubject
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

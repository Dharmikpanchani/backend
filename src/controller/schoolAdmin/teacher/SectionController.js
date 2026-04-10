import { StatusCodes } from 'http-status-codes';
import Section from '../../../models/teacher/Section.js';
import Class from '../../../models/teacher/Class.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  queryBuilder,
} from '../../../services/CommonServices.js';
import { responseMessage } from '../../../utils/ResponseMessage.js';
import Logger from '../../../utils/Logger.js';

const logger = new Logger(
  './src/controller/schoolAdmin/teacher/SectionController.js'
);

//#region ➕ Add / ✏️ Edit Section
export const addEditSection = async (req, res) => {
  try {
    const { id, name, code, classId } = req.body;
    const schoolId = req.school_id;

    const payload = {
      name: name?.trim(),
      code: code?.trim(),
      classId,
      schoolId,
    };

    if (id) {
      // 🔹 Update flow
      const existingSection = await Section.findOne({
        _id: id,
        ...req.schoolFilter,
      });

      if (!existingSection) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SECTION_NOT_FOUND
        );
      }

      const duplicate = await Section.findOne({
        _id: { $ne: id },
        classId: payload.classId,
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.SECTION_ALREADY_EXISTS
        );
      }

      const result = await Section.findByIdAndUpdate(id, payload, {
        new: true,
      });

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.SECTION_UPDATED,
        result
      );
    } else {
      // 🔹 Create flow
      const duplicate = await Section.findOne({
        classId: payload.classId,
        $or: [{ code: payload.code }, { name: payload.name }],
        ...req.schoolFilter,
      });

      if (duplicate) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.SECTION_ALREADY_EXISTS
        );
      }

      // Check for soft-deleted one to restore
      const deletedSection = await Section.findOne({
        classId: payload.classId,
        $or: [{ code: payload.code }, { name: payload.name }],
        schoolId,
        isDeleted: true,
      });

      let result;
      if (deletedSection) {
        result = await Section.findByIdAndUpdate(
          deletedSection._id,
          { ...payload, isDeleted: false, isActive: true },
          { new: true }
        );
      } else {
        result = await Section.create(payload);
      }

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.SECTION_ADDED,
        result
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get Sections
export const getSections = async (req, res) => {
  try {
    const { classId, pageNumber, perPageData, searchRequest, isActive, type } =
      req?.query || {};

    const filters = {
      ...req.schoolFilter,
    };

    if (type) {
      filters.isActive = true;
    } else if (isActive !== undefined && isActive !== '') {
      filters.isActive = isActive;
    }

    if (classId) {
      filters.classId = classId;
    }

    let extraOrConditions = [];
    if (searchRequest) {
      const matchingClasses = await Class.find({
        name: { $regex: searchRequest, $options: 'i' },
        ...req.schoolFilter,
      }).select('_id');

      if (matchingClasses.length > 0) {
        extraOrConditions.push({
          classId: { $in: matchingClasses.map((c) => c._id) },
        });
      }
    }

    const result = await queryBuilder(Section, {
      pageNumber: type ? 1 : pageNumber,
      perPageData: type ? Number.MAX_SAFE_INTEGER : perPageData,
      searchRequest,
      searchableFields: ['name', 'code'],
      extraOrConditions,
      booleanFields: ['isActive'],
      sort: { createdAt: -1 },
      filters,
      populate: [{ path: 'classId', select: 'name code' }],
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
      responseMessage.SECTION_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Section
export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await Section.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SECTION_NOT_FOUND
      );
    }

    // ✅ Scramble the code/name to free the unique index slot if needed
    const scrambledCode = `${data.code}_deleted_${Date.now()}`;
    const scrambledName = `${data.name}_deleted_${Date.now()}`;
    await Section.findByIdAndUpdate(data._id, {
      isDeleted: true,
      code: scrambledCode,
      name: scrambledName,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SECTION_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🔍 Get Section By ID
export const getSectionById = async (req, res) => {
  try {
    const data = await Section.findOne({
      _id: req.params.id,
      ...req.schoolFilter,
    }).populate([{ path: 'classId', select: 'name code' }]);

    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SECTION_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SECTION_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚙️ Update Section Status
export const sectionStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const section = await Section.findOne({
      _id: id,
      ...req.schoolFilter,
    });

    if (!section) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SECTION_NOT_FOUND
      );
    }

    const updatedSection = await Section.findByIdAndUpdate(
      id,
      { isActive: !section.isActive },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SECTION_STATUS_UPDATED,
      updatedSection
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

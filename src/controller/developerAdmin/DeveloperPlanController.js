import Plan from '../../models/common/Plan.js';
import Admin from '../../models/common/Admin.js';
import config from '../../config/Index.js';
import { responseMessage } from '../../utils/ResponseMessage.js';
import {
  ResponseHandler,
  CatchErrorHandler,
  queryBuilder,
} from '../../services/CommonServices.js';
import { StatusCodes } from 'http-status-codes';
import Logger from '../../utils/Logger.js';

const logger = new Logger(
  './src/controller/developerAdmin/DeveloperPlanController.js'
);

//#region ➕ Add / ✏️ Edit Plan
export const addEditPlan = async (req, res) => {
  try {
    const {
      id,
      planName,
      price,
      billingCycle,
      maxStudents,
      maxTeachers,
      maxClasses,
      permissions,
    } = req.body;

    const payload = {
      planName,
      price,
      billingCycle,
      maxStudents,
      maxTeachers,
      maxClasses,
      permissions,
      adminId: req.developer_id, // Track which developer managed this plan
    };

    let result;
    if (id) {
      // Update existing plan
      const existingPlan = await Plan.findOne({ _id: id, isDeleted: false });
      if (!existingPlan) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.PLAN_NOT_FOUND
        );
      }

      // Check for duplicate name in other plans
      const duplicatePlan = await Plan.findOne({
        _id: { $ne: id },
        planName,
        isDeleted: false,
      });
      if (duplicatePlan) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.PLAN_ALREADY_EXISTS
        );
      }

      result = await Plan.findOneAndUpdate(
        { _id: id, isDeleted: false },
        payload,
        { new: true }
      );
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.PLAN_UPDATED,
        result
      );
    } else {
      // Create new plan
      const duplicatePlan = await Plan.findOne({ planName, isDeleted: false });
      if (duplicatePlan) {
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.PLAN_ALREADY_EXISTS
        );
      }

      // Check if a soft-deleted plan exists with the same name, if so restore it
      const deletedPlan = await Plan.findOne({ planName, isDeleted: true });
      if (deletedPlan) {
        result = await Plan.findByIdAndUpdate(
          deletedPlan._id,
          { ...payload, isDeleted: false, isActive: true },
          { new: true }
        );
      } else {
        result = await Plan.create(payload);
      }

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.PLAN_ADDED,
        result
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get All Plans
export const getAllPlans = async (req, res) => {
  try {
    const {
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      developerId,
      developerEmail,
      developerName,
      developerPhoneNumber,
      planName,
    } = req.query;

    const baseQuery = {};

    if (planName) {
      baseQuery.planName = { $regex: planName, $options: 'i' };
    }

    // 🔥 Role-based access logic
    if (req.developer.type !== config.SUPER_ADMIN) {
      // Regular developers only see their own plans
      baseQuery.adminId = req.developer_id;
    } else if (developerId) {
      // Super developers can filter by a specific developer
      baseQuery.adminId = developerId;
    }

    // 🔥 Cross-filter by Developer details (Email, Name, Number)
    if (developerEmail || developerName || developerPhoneNumber) {
      const adminSearchQuery = {
        isDeleted: false,
        type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
      };

      if (developerEmail)
        adminSearchQuery.email = { $regex: developerEmail, $options: 'i' };
      if (developerName)
        adminSearchQuery.name = { $regex: developerName, $options: 'i' };
      if (developerPhoneNumber)
        adminSearchQuery.phoneNumber = {
          $regex: developerPhoneNumber,
          $options: 'i',
        };

      const matchedAdmins = await Admin.find(adminSearchQuery).select('_id');
      const adminIds = matchedAdmins.map((admin) => admin._id);

      // Intersect with existing baseQuery.adminId if present
      if (baseQuery.adminId) {
        if (!adminIds.some((id) => id.equals(baseQuery.adminId))) {
          baseQuery.adminId = { $in: [] }; // No match possible
        }
      } else {
        baseQuery.adminId = { $in: adminIds };
      }
    }

    const result = await queryBuilder(Plan, {
      pageNumber,
      perPageData,
      searchRequest,
      searchableFields: ['planName'],
      booleanFields: ['isActive'],
      sort: { createdAt: -1 },
      baseQuery,
      filters: {
        isActive,
      },
      populate: [{ path: 'adminId', select: 'name email phoneNumber image' }],
    });

    const data = {
      pagination: result.pagination,
      data: result.data,
    };

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PLAN_FETCH_SUCCESS,
      data
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get Plan By Id
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id, isDeleted: false };
    if (req.developer.type !== config.SUPER_ADMIN)
      query.adminId = req.developer_id;

    const plan = await Plan.findOne(query).populate({
      path: 'adminId',
      select: 'name email phoneNumber',
    });

    if (!plan) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.PLAN_NOT_FOUND
      );
    }

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PLAN_FETCH_SUCCESS,
      plan
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Plan (Soft Delete)
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id, isDeleted: false };
    if (req.developer.type !== config.SUPER_ADMIN)
      query.adminId = req.developer_id;

    const plan = await Plan.findOne(query);

    if (!plan) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.PLAN_NOT_FOUND
      );
    }

    // Scramble name to free unique index if necessary
    const scrambledName = `${plan.planName}_deleted_${Date.now()}`;
    await Plan.findByIdAndUpdate(id, {
      isDeleted: true,
      planName: scrambledName,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PLAN_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚡ Plan Status Handler (Toggle Active)
export const planStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const query = { _id: id, isDeleted: false };
    if (req.developer.type !== config.SUPER_ADMIN)
      query.adminId = req.developer_id;

    const plan = await Plan.findOne(query);

    if (!plan) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.PLAN_NOT_FOUND
      );
    }

    const updatedPlan = await Plan.findByIdAndUpdate(
      id,
      { isActive: !plan.isActive },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PLAN_STATUS_UPDATED,
      updatedPlan
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

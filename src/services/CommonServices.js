import { StatusCodes } from 'http-status-codes';
import { responseMessage } from '../utils/ResponseMessage.js';
import config from '../config/Index.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

//#region for error handler
export function CatchErrorHandler(res, error) {
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message: responseMessage.INTERNAL_SERVER_ERROR,
    data: error.message,
  });
}
//#endregion

//#region for response handler
export function ResponseHandler(res, status, message, result = {}) {
  let responseData = result?.data ?? result;

  if (Array.isArray(responseData)) {
    responseData = responseData.map((item) => filterData(item));
  } else if (responseData && typeof responseData === 'object') {
    responseData = filterData(responseData);
  }

  return res.status(status).json({
    status,
    message,
    ...(result?.pagination && { pagination: result.pagination }),
    data: responseData,
  });
}

/**
 * Common function to filter out unwanted fields from Response Data
 * @param {Object} data - Mongoose Document or Plain JS Object
 * @param {Array<string>} keysToRemove - Keys to remove (e.g. ['password', '__v'])
 * @returns {Object} Cleaned Object
 */
export function filterData(
  data,
  keysToRemove = [
    'password',
    '__v',
    'otp',
    'otpExpireAt',
    'referralId',
    // 'createdAt',
    'isDeleted',
  ]
) {
  if (!data) return null;

  // Convert mongoose documents to plain JSON if needed
  let result = data.toObject ? data.toObject() : { ...data };

  keysToRemove.forEach((key) => {
    delete result[key];
  });

  return result;
}
//#endregion

//#region for password encryption
export async function encryptPassword(password) {
  const salt = await bcrypt.genSalt(10);
  let encrypt = bcrypt.hash(password, salt);
  return encrypt;
}
//#endregion

//#region for jwt token
export const genrateToken = ({ payload }) => {
  return jwt.sign(payload, config.JWT_SECRET_KEY, {
    expiresIn: '24h',
  });
};
//#endregion

//#region for query builder
export const queryBuilder = async (model, options = {}) => {
  const {
    pageNumber = 1,
    perPageData = 10,
    searchRequest = '',
    searchableFields = [],
    booleanFields = [],
    dateFields = [],
    nestedFields = [],
    baseQuery = {},
    filters = {},
    sort = { createdAt: -1 },
    populate = [],
    select = '',
    lean = true,
  } = options;

  const query = { isDeleted: false, ...baseQuery };

  // Filters (AND)
  Object.keys(filters).forEach((key) => {
    if (filters[key] !== undefined) {
      if (filters[key] === 'true') query[key] = true;
      else if (filters[key] === 'false') query[key] = false;
      else query[key] = filters[key];
    }
  });

  // Search (OR)
  if (searchRequest) {
    const regex = new RegExp(searchRequest, 'i');
    const searchLower = searchRequest.toLowerCase();
    let orConditions = [];

    searchableFields.forEach((field) => {
      orConditions.push({ [field]: regex });
    });

    nestedFields.forEach((field) => {
      orConditions.push({ [field]: regex });
    });

    booleanFields.forEach((field) => {
      if (searchLower === field.toLowerCase())
        orConditions.push({ [field]: true });

      if (searchLower === `not ${field.toLowerCase()}`)
        orConditions.push({ [field]: false });
    });

    if (!isNaN(Date.parse(searchRequest))) {
      const date = new Date(searchRequest);
      dateFields.forEach((field) => {
        orConditions.push({
          [field]: {
            $gte: new Date(date.setHours(0, 0, 0, 0)),
            $lte: new Date(date.setHours(23, 59, 59, 999)),
          },
        });
      });
    }

    if (options.extraOrConditions && Array.isArray(options.extraOrConditions)) {
      orConditions.push(...options.extraOrConditions);
    }

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }
  }

  const page = parseInt(pageNumber);
  const limit = parseInt(perPageData);
  const skip = (page - 1) * limit;

  let dataQuery = model
    .find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select(select);

  populate.forEach((field) => {
    dataQuery = dataQuery.populate(field);
  });

  if (lean) dataQuery = dataQuery.lean();

  const [data, total] = await Promise.all([
    dataQuery,
    model.countDocuments(query),
  ]);
  return {
    pagination: {
      totalArrayLength: total,
      pageNumber: page,
      perPageData: limit,
      totalPages: Math.ceil(total / limit),
    },
    data,
  };
};
//#endregion

import { StatusCodes } from 'http-status-codes';
import School from '../../models/school/School.js';
import SchoolTheme from '../../models/school/SchoolTheme.js';
import Plan from '../../models/common/Plan.js';
import Admin from '../../models/common/Admin.js';
import {
  CatchErrorHandler,
  ResponseHandler,
  encryptPassword,
  queryBuilder,
} from '../../services/CommonServices.js';
import Logger from '../../utils/Logger.js';
import { storeOtp, checkOtpRateLimit } from '../../services/OtpService.js';
import { sendRegisterVerificationEmail } from '../../services/EmailServices.js'; // Can be reused for OTP or make a specific one

import { responseMessage } from '../../utils/ResponseMessage.js';
import config from '../../config/Index.js';
import { moduleDescriptionsMapping } from '../../utils/RolePermissionList.js';

const logger = new Logger('./src/controller/school/SchoolController.js');

//#region ➕ Add / ✏️ Edit School Profile
export const addEditSchool = async (req, res) => {
  try {
    const {
      id,
      schoolName,
      ownerName,
      email,
      phoneNumber,
      password,
      schoolCode,
      address,
      city,
      state,
      zipCode,
      country,
      board,
      schoolType,
      medium,
      establishedYear,
      registrationNumber,
      gstNumber,
      panNumber,
      latitude,
      longitude,
    } = req.body;

    if (id) {
      // 📝 UPDATE FLOW
      const existingSchool = await School.findOne({
        _id: id,
        isDeleted: false,
      });
      if (!existingSchool) {
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.SCHOOL_NOT_FOUND
        );
      }

      // Check for duplicates (excluding current school)
      const duplicate = await School.findOne({
        _id: { $ne: id },
        $or: [{ email }, { phoneNumber }, { schoolCode }],
        isDeleted: false,
      });

      if (duplicate) {
        if (duplicate.email === email) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.EMAIL_ALREADY_EXISTS
          );
        }
        if (duplicate.phoneNumber === phoneNumber) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.PHONE_NUMBER_ALREADY_EXISTS
          );
        }
        if (duplicate.schoolCode === schoolCode) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.SCHOOL_CODE_ALREADY_EXISTS
          );
        }
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.SCHOOL_ALREADY_EXISTS
        );
      }

      const updateData = {
        schoolName,
        ownerName,
        phoneNumber,
        address,
        city,
        state,
        zipCode,
        country,
        board,
        schoolType,
        medium,
        establishedYear,
        registrationNumber,
        gstNumber,
        panNumber,
        latitude,
        longitude,
      };

      if (password) {
        updateData.password = await encryptPassword(password);
      }

      // Handle File Uploads from MediaUpload middleware
      if (req.logo) updateData.logo = req.logo;
      if (req.banner) updateData.banner = req.banner;
      if (req.affiliationCertificate)
        updateData.affiliationCertificate = req.affiliationCertificate;

      const updatedSchool = await School.findByIdAndUpdate(id, updateData, {
        new: true,
      }).populate('planId');

      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.SCHOOL_UPDATED_SUCCESSFULLY,
        updatedSchool
      );
    } else {
      // 🆕 CREATE FLOW
      // 1. Check for duplicates
      const existingSchool = await School.findOne({
        $or: [{ email }, { phoneNumber }, { schoolCode }],
        isDeleted: false,
      });

      if (existingSchool) {
        if (existingSchool.email === email) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.EMAIL_ALREADY_EXISTS
          );
        }
        if (existingSchool.phoneNumber === phoneNumber) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.PHONE_NUMBER_ALREADY_EXISTS
          );
        }
        if (existingSchool.schoolCode === schoolCode) {
          return ResponseHandler(
            res,
            StatusCodes.CONFLICT,
            responseMessage.SCHOOL_CODE_ALREADY_EXISTS
          );
        }
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.SCHOOL_ALREADY_EXISTS
        );
      }

      // 3. Hash Passwords
      const schoolPassword = await encryptPassword(password);
      const adminPass = await encryptPassword(password);

      // 4. OTP Rate Limit
      const rateLimit = await checkOtpRateLimit('school', email);
      if (rateLimit.limited) {
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );
      }

      // 5. Find a "Free" plan from the developer
      const freePlan = await Plan.findOne({
        planName: { $regex: /free/i },
        isDeleted: false,
        isActive: true,
        billingCycle: 'monthly',
      });

      const newSchool = await School.create({
        schoolName,
        ownerName,
        email,
        phoneNumber,
        schoolCode,
        password: schoolPassword,
        referralId: req.developer_id,
        planId: freePlan ? freePlan._id : null,
        address,
        city,
        state,
        zipCode,
        country,
        board,
        schoolType,
        medium,
        establishedYear,
        registrationNumber,
        gstNumber,
        panNumber,
        latitude,
        longitude,
        logo: req.logo || '',
        banner: req.banner || '',
        affiliationCertificate: req.affiliationCertificate || '',
        PlanExptyDate: config.FIRST_PLAN_EXPIRY(),
      });

      // ✅ 6. CREATE DEFAULT ADMIN
      const newAdmin = await Admin.create({
        name: ownerName,
        email: email,
        password: adminPass,
        isSuperAdmin: true,
        schoolId: newSchool._id,
        isVerified: false,
        type: config.SCHOOL_ADMIN,
      });

      // 8. OTP for Admin
      // const otp = await generateOtp();
      const otp = 444444;
      await storeOtp('admin', newAdmin.email, otp);

      sendRegisterVerificationEmail(
        `Your School Register OTP is: ${otp}`,
        newAdmin.email,
        'School',
        'Register'
      ).catch((err) => logger.error(err));

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.SCHOOL_ADMIN_REGISTERED_SUCCESSFULLY,
        {
          schoolEmail: newSchool.email,
          adminEmail: newAdmin.email,
        }
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Profile GET/UPDATE (for School Admin Portal)
export const getProfile = async (req, res) => {
  try {
    const school = await School.findById(req.school_id).populate('planId');
    if (!school) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SCHOOL_NOT_FOUND
      );
    }

    const responseData = {
      id: school._id,
      schoolName: school.schoolName,
      ownerName: school.ownerName,
      phoneNumber: school.phoneNumber,
      email: school.email,
      address: school.address,
      city: school.city,
      state: school.state,
      zipCode: school.zipCode,
      country: school.country,
      board: school.board,
      schoolType: school.schoolType,
      medium: school.medium,
      establishedYear: school.establishedYear,
      registrationNumber: school.registrationNumber,
      gstNumber: school.gstNumber,
      panNumber: school.panNumber,
      latitude: school.latitude,
      longitude: school.longitude,
      logo: school.logo,
      banner: school.banner,
      affiliationCertificate: school.affiliationCertificate,
      isActive: school.isActive,
      PlanExptyDate: school.PlanExptyDate,
      planData: school.planId,
    };

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.PROFILE_RETRIEVED_EFFECTIVELY,
      responseData
    );
  } catch (error) {
    logger.error(`Get Profile error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const {
      schoolName,
      ownerName,
      phoneNumber,
      address,
      city,
      state,
      zipCode,
      country,
      board,
      schoolType,
      medium,
      establishedYear,
      registrationNumber,
      gstNumber,
      panNumber,
      latitude,
      longitude,
    } = req.body;
    const schoolId = req.school_id;

    const school = await School.findById(schoolId);
    if (!school) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SCHOOL_NOT_FOUND
      );
    }

    if (phoneNumber && phoneNumber !== school.phoneNumber) {
      const duplicate = await School.findOne({
        phoneNumber,
        _id: { $ne: schoolId },
      });
      if (duplicate)
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.PHONE_NUMBER_ALREADY_EXISTS
        );
      school.phoneNumber = phoneNumber;
    }

    if (schoolName) school.schoolName = schoolName;
    if (ownerName) school.ownerName = ownerName;
    if (address !== undefined) school.address = address;
    if (city !== undefined) school.city = city;
    if (state !== undefined) school.state = state;
    if (zipCode !== undefined) school.zipCode = zipCode;
    if (country !== undefined) school.country = country;
    if (board !== undefined) school.board = board;
    if (schoolType !== undefined) school.schoolType = schoolType;
    if (medium !== undefined) school.medium = medium;
    if (establishedYear !== undefined) school.establishedYear = establishedYear;
    if (registrationNumber !== undefined)
      school.registrationNumber = registrationNumber;
    if (gstNumber !== undefined) school.gstNumber = gstNumber;
    if (panNumber !== undefined) school.panNumber = panNumber;
    if (latitude !== undefined) school.latitude = latitude;
    if (longitude !== undefined) school.longitude = longitude;

    // Handle File Uploads
    if (req.logo) school.logo = req.logo;
    if (req.banner) school.banner = req.banner;
    if (req.affiliationCertificate)
      school.affiliationCertificate = req.affiliationCertificate;

    await school.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_UPDATED_SUCCESSFULLY,
      school
    );
  } catch (error) {
    logger.error(`Update Profile error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region get all Schools (for Developer Portal)
export const getAllSchools = async (req, res) => {
  try {
    const {
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      isVerified,
      board,
      schoolType,
      referralId,
      adminId,
      isActivePlan,
      planName,
      schoolCode,
      panNumber,
      gstNumber,
      registrationNumber,
      establishedYear,
    } = req.query;

    const isSuperDeveloper = req.developer.type === config.SUPER_ADMIN;

    const filters = {
      isActive,
      isVerified,
      board,
      schoolType,
      referralId: adminId || referralId,
      isActivePlan,
      schoolCode,
      panNumber,
      gstNumber,
      registrationNumber,
      establishedYear,
      isDeleted: false,
    };

    // If planName filter is provided, find matching plan IDs
    if (planName) {
      const matchingPlans = await Plan.find({
        planName: { $regex: planName, $options: 'i' },
        isDeleted: false,
      }).select('_id');

      if (matchingPlans.length > 0) {
        filters.planId = { $in: matchingPlans.map((p) => p._id) };
      } else {
        // Force no results if planName specified but no plans match
        filters.planId = '000000000000000000000000';
      }
    }

    // Clean up filters
    Object.keys(filters).forEach((key) => {
      if (
        filters[key] === undefined ||
        filters[key] === null ||
        filters[key] === ''
      ) {
        delete filters[key];
      }
    });

    // If not a super developer, strictly restrict them to their own referralId
    if (!isSuperDeveloper) {
      filters.referralId = req.developer._id;
    }

    let extraOrConditions = [];
    if (searchRequest && isSuperDeveloper) {
      const matchingAdmins = await Admin.find({
        type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
        $or: [
          { name: { $regex: searchRequest, $options: 'i' } },
          { email: { $regex: searchRequest, $options: 'i' } },
          { phoneNumber: { $regex: searchRequest, $options: 'i' } },
        ],
        isDeleted: false,
      }).select('_id');

      if (matchingAdmins.length > 0) {
        const adminIds = matchingAdmins.map((a) => a._id);
        extraOrConditions.push({ referralId: { $in: adminIds } });
      }
    }

    const result = await queryBuilder(School, {
      pageNumber,
      perPageData,
      searchRequest,
      searchableFields: [
        'schoolName',
        'ownerName',
        'email',
        'phoneNumber',
        'address',
        'city',
        'state',
        'zipCode',
        'country',
        'schoolCode',
      ],
      booleanFields: ['isActive', 'isVerified', 'isDeleted'],
      dateFields: ['createdAt'],
      nestedFields: [
        'referralId.name',
        'referralId.email',
        'referralId.phoneNumber',
      ],
      extraOrConditions,
      filters,
      populate: [
        { path: 'referralId', select: 'name email phoneNumber' },
        { path: 'planId' },
      ],
    });

    const data = {
      pagination: result.pagination,
      data: result.data,
    };

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOLS_RETRIEVED_SUCCESSFULLY,
      data
    );
  } catch (error) {
    logger.error(`Get All Schools error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region get school by id (for Developer Portal)
export const getSchoolById = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const data = await School.findOne({
      _id: schoolId,
      isDeleted: false,
    }).populate('planId');
    if (!data) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SCHOOL_NOT_FOUND
      );
    }
    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_RETRIEVED_SUCCESSFULLY,
      data
    );
  } catch (error) {
    logger.error(`Get School By Id error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region get school image by code
export const getSchoolImageByCode = async (req, res) => {
  try {
    const school = await School.findOne({
      _id: req.school_id,
      isDeleted: false,
    }).select('logo schoolName');

    if (!school) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SCHOOL_NOT_FOUND
      );
    }

    const theme = await SchoolTheme.findOne({ schoolId: req.school_id });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_RETRIEVED_SUCCESSFULLY,
      { logo: school.logo, schoolName: school.schoolName, theme: theme || {} }
    );
  } catch (error) {
    logger.error(`Get School Image By Code error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#region school status handler
export const schoolStatusHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const school = await School.findOne({ _id: schoolId, isDeleted: false });

    if (!school) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SCHOOL_NOT_FOUND
      );
    }

    school.isActive = !school.isActive;
    await school.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_STATUS_UPDATED,
      school
    );
  } catch (error) {
    logger.error(`School Status Handler error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region delete school
export const deleteSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const school = await School.findOne({ _id: schoolId, isDeleted: false });

    if (!school) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.SCHOOL_NOT_FOUND
      );
    }

    if (school.isVerified) {
      return ResponseHandler(
        res,
        StatusCodes.BAD_REQUEST,
        responseMessage.SCHOOL_CANNOT_BE_DELETED_ALREADY_VERIFIED
      );
    }

    school.isDeleted = true;
    await school.save();

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(`Delete School error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region Update School Theme
export const updateSchoolTheme = async (req, res) => {
  try {
    const schoolId = req.school_id;
    const themeData = req.body;

    const updatedTheme = await SchoolTheme.findOneAndUpdate(
      { schoolId },
      { ...themeData },
      { new: true, upsert: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.THEME_UPDATED_SUCCESSFULLY,
      updatedTheme
    );
  } catch (error) {
    logger.error(`Update School Theme error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion
//#region Helper: Get Module Descriptions

const getModuleDescriptions = (permissions) => {
  if (!permissions || !Array.isArray(permissions)) return [];

  const uniqueModules = new Set();
  permissions.forEach((perm) => {
    const lastUnderscoreIndex = perm.lastIndexOf('_');
    if (lastUnderscoreIndex !== -1) {
      uniqueModules.add(perm.substring(0, lastUnderscoreIndex));
    }
  });

  return Array.from(uniqueModules)
    .map(
      (key) =>
        moduleDescriptionsMapping[key] ||
        key
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
    )
    .filter(Boolean);
};
//#endregion

//#region Get Developer Wise School Plan
export const getDeveloperWiseSchoolPlan = async (req, res) => {
  try {
    const developerId = req.developer_id;

    if (!developerId) {
      return ResponseHandler(
        res,
        StatusCodes.UNAUTHORIZED,
        responseMessage.AUTHENTICATION_REQUIRED
      );
    }

    // 1. Fetch all plans belonging to this developer
    const plans = await Plan.find({
      adminId: developerId,
      isDeleted: false,
    }).lean();

    // 3. Map schools into their respective plans
    const data = plans.map((plan) => {
      const { permissions, ...planData } = plan;
      return {
        ...planData,
        moduleDescription: getModuleDescriptions(permissions),
      };
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.SCHOOL_PLAN_DATA_FETCHED,
      data
    );
  } catch (error) {
    logger.error(`Get Developer Wise School Plan error: ${error}`);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

import Admin from '../../models/common/Admin.js';
import { responseMessage } from '../../utils/ResponseMessage.js';
import {
  ResponseHandler,
  CatchErrorHandler,
  encryptPassword,
  queryBuilder,
} from '../../services/CommonServices.js';
import { StatusCodes } from 'http-status-codes';
import { sendRegisterVerificationEmail } from '../../services/EmailServices.js';
import Logger from '../../utils/Logger.js';
import {
  // generateOtp,
  storeOtp,
  verifyOtp,
  checkOtpRateLimit,
} from '../../services/OtpService.js';
import School from '../../models/school/School.js';
import config from '../../config/Index.js';

const logger = new Logger(
  './src/controller/developerAdmin/DeveloperAdminController.js'
);

//#region ➕ Add / ✏️ Edit DeveloperAdmin Profile
export const addEditAdminProfile = async (req, res) => {
  try {
    const {
      id,
      name,
      email,
      password,
      role,
      address,
      phoneNumber,
      otp,
    } = req?.body || {};

    const payload = {
      name,
      email,
      address,
      phoneNumber,
      type: config.DEVELOPER, // Default type created by developer panel
    };

    if (password) {
      payload.password = await encryptPassword(password);
    }
    if (role) {
      payload.role = role;
    }

    let result;
    if (id) {
      const existingAdmin = await Admin.findOne({
        _id: id,
        isDeleted: false,
      });
      if (!existingAdmin)
        return ResponseHandler(
          res,
          StatusCodes.NOT_FOUND,
          responseMessage.ADMIN_NOT_FOUND
        );

      const duplicateAdmin = await Admin.findOne({
        _id: { $ne: id },
        email,
        schoolId: null,
        isDeleted: false,
      });
      if (duplicateAdmin)
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ADMIN_ALREADY_EXISTS
        );

      if (!otp) {
        const rateLimit = await checkOtpRateLimit(
          'admin_update',
          req.developer.email
        );
        if (rateLimit.limited)
          return ResponseHandler(
            res,
            StatusCodes.TOO_MANY_REQUESTS,
            rateLimit.message
          );

        // const otpCode = generateOtp();
        const otpCode = 444444;
        await storeOtp('admin_update', req.developer.email, otpCode);
        sendRegisterVerificationEmail(
          `Your Admin Update Verification OTP is: ${otpCode}`,
          req.developer.email,
          'Admin',
          'Profile Update'
        ).catch((err) =>
          logger.error(`Error sending Admin Update OTP: ${err}`)
        );

        return ResponseHandler(res, StatusCodes.OK, 'OTP sent to your email', {
          requireOtp: true,
          email: req.developer.email,
        });
      }

      const otpResult = await verifyOtp(
        'admin_update',
        req.developer.email,
        otp
      );
      if (!otpResult.success) {
        return ResponseHandler(res, StatusCodes.BAD_REQUEST, otpResult.message);
      }

      result = await Admin.findByIdAndUpdate(id, payload, {
        new: true,
      });
      return ResponseHandler(
        res,
        StatusCodes.OK,
        responseMessage.PROFILE_UPDATED,
        result
      );
    } else {
      // Create flow — check active admins first
      const duplicateAdmin = await Admin.findOne({
        email,
        isDeleted: false,
      });
      if (duplicateAdmin)
        return ResponseHandler(
          res,
          StatusCodes.CONFLICT,
          responseMessage.ADMIN_ALREADY_EXISTS
        );

      if (!password)
        return ResponseHandler(
          res,
          StatusCodes.BAD_REQUEST,
          responseMessage.PASSWORD_IS_REQUIRED_TO_CREATE_A_NEW_ADM
        );

      // Rate limit check
      const rateLimit = await checkOtpRateLimit('developer', email);
      if (rateLimit.limited)
        return ResponseHandler(
          res,
          StatusCodes.TOO_MANY_REQUESTS,
          rateLimit.message
        );

      // ✅ Check if a soft-deleted admin exists with the same email.
      // If so, restore it instead of inserting a new document to avoid
      // the unique index conflict on (email, schoolId).
      payload.isVerified = false;
      payload.isDeleted = false;
      payload.isActive = true;
      payload.isLogin = false;

      const deletedAdmin = await Admin.findOne({ email, isDeleted: true });
      if (deletedAdmin) {
        result = await Admin.findByIdAndUpdate(deletedAdmin._id, payload, {
          new: true,
        });
      } else {
        result = await Admin.create(payload);
      }

      // Send OTP
      // const otp = generateOtp();
      const otp = 444444;
      await storeOtp('developer', email, otp);
      sendRegisterVerificationEmail(
        `Your Admin Register OTP is: ${otp}`,
        email,
        'Admin',
        'Register'
      ).catch((err) =>
        logger.error(`Error sending Admin Registration OTP: ${err}`)
      );

      return ResponseHandler(
        res,
        StatusCodes.CREATED,
        responseMessage.ADMIN_CREATED,
        { email }
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get All Admins
export const getAllAdmins = async (req, res) => {
  try {
    const {
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      isVerified,
      isLogin,
      role,
    } = req?.query || {};

    const extraFilters = {
      type: { $in: [config.SUPER_ADMIN, config.DEVELOPER] },
    };

    const result = await queryBuilder(Admin, {
      pageNumber,
      perPageData,
      searchRequest,

      searchableFields: ['name', 'email', 'phoneNumber', 'address'],
      booleanFields: ['isActive', 'isVerified', 'isLogin'],
      dateFields: ['createdAt'],
      nestedFields: ['role.name'],

      filters: {
        isActive,
        isVerified,
        isLogin,
        role,
        ...extraFilters,
      },

      populate: [{ path: 'role', select: 'role isActive' }],
    });

    const data = {
      pagination: result.pagination,
      data: result.data,
    };
    return ResponseHandler(res, 200, responseMessage.ADMIN_FETCH_SUCCESS, data);
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 📄 Get Admin By Id
export const getAdminById = async (req, res) => {
  try {
    const { id } = req?.params || {};
    const {
      pageNumber,
      perPageData,
      searchRequest,
      isActive,
      isVerified,
      board,
      schoolType,
      schoolCode,
      panNumber,
      gstNumber,
      registrationNumber,
      establishedYear,
    } = req?.query || {};

    const isLoginAdmin = await Admin.findById({
      _id: req?.developer_id,
      isDeleted: false,
    });
    const admin = await Admin.findOne({
      _id: id,
      isDeleted: false,
    }).populate({ path: 'role', select: 'role isActive' });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    let adminData = admin.toObject();

    // Fetch associated schools using queryBuilder for standardized search/filter/pagination
    if (isLoginAdmin?.type === config.SUPER_ADMIN) {
      const result = await queryBuilder(School, {
        pageNumber,
        perPageData,
        searchRequest,
        searchableFields: [
          'schoolName',
          'ownerName',
          'email',
          'phoneNumber',
          'city',
          'schoolCode',
        ],
        filters: {
          referralId: id,
          isActive,
          isVerified,
          board,
          schoolType,
          schoolCode,
          panNumber,
          gstNumber,
          registrationNumber,
          establishedYear,
        },
      });

      adminData.schools = result.data;
      // Wrap the response to include school-level pagination
      const finalResult = {
        data: adminData,
        pagination: result.pagination,
      };

      return ResponseHandler(
        res,
        200,
        responseMessage.ADMIN_FETCH_SUCCESS,
        finalResult
      );
    } else {
      adminData.schools = [];
      return ResponseHandler(
        res,
        200,
        responseMessage.ADMIN_FETCH_SUCCESS,
        adminData
      );
    }
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region 🗑️ Delete Admin (Soft Delete)
export const deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      _id: req?.params?.id,
      isDeleted: false,
    });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    if (admin.isSuperAdmin || admin.type === config.SUPER_ADMIN) {
      return ResponseHandler(
        res,
        StatusCodes.FORBIDDEN,
        responseMessage.SUPER_ADMIN_CANNOT_BE_DELETED
      );
    }

    // ✅ Scramble the email to free the unique index slot (email, schoolId).
    // This allows the same email to be re-registered later without an E11000 error.
    const scrambledEmail = `${admin.email}_deleted_${Date.now()}`;
    await Admin.findByIdAndUpdate(admin._id, {
      isDeleted: true,
      email: scrambledEmail,
    });

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_DELETE_SUCCESS
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

//#region ⚡ Admin Status Handler (Toggle Active)
export const adminStatusHandler = async (req, res) => {
  try {
    const { id } = req?.params || {};

    const admin = await Admin.findOne({
      _id: req?.params?.id,
      isDeleted: false,
    });

    if (!admin) {
      return ResponseHandler(
        res,
        StatusCodes.NOT_FOUND,
        responseMessage.ADMIN_NOT_FOUND
      );
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      id,
      { isActive: !admin.isActive },
      { new: true }
    );

    return ResponseHandler(
      res,
      StatusCodes.OK,
      responseMessage.ADMIN_STATUS_UPDATED,
      updatedAdmin
    );
  } catch (error) {
    logger.error(error);
    return CatchErrorHandler(res, error);
  }
};
//#endregion

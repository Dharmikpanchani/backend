import joi from 'joi';
import { joiPasswordExtendCore } from 'joi-password';
const joiPassword = joi.extend(joiPasswordExtendCore);
const joistring = joi.string();

const adminLoginSchema = joi.object().keys({
  email: joistring.email().required().label('Email'),
  password: joistring.required().label('Password'),
  schoolCode: joistring.required().label('School Code'),
});

const changePasswordSchema = joi.object().keys({
  oldPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'Old password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'Old password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'Old password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'Old password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'Old password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'Old password must be at least 8 characters long.',
    })
    .required()
    .label('Old password'),

  newPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'New password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'New password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'New password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'New password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'New password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'New password must be at least 8 characters long.',
    })
    .required()
    .label('New password'),

  confirmPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'Confirm password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'Confirm password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'Confirm password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'Confirm password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'Confirm password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'Confirm password must be at least 8 characters long.',
    })
    .required()
    .label('Confirm password'),
});

const adminForgotPasswordSchema = joi.object().keys({
  email: joistring.email().required().label('Email'),
  schoolCode: joi.string().required().label('School Code'),
});

const adminResetPasswordSchema = joi.object().keys({
  email: joistring.email().required().label('Email'),
  schoolCode: joi.string().required().label('School Code'),
  newPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'New password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'New password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'New password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'New password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'New password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'New password must be at least 8 characters long.',
    })
    .required()
    .label('New password'),

  confirmPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'Confirm password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'Confirm password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'Confirm password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'Confirm password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'Confirm password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'Confirm password must be at least 8 characters long.',
    })
    .required()
    .label('Confirm password'),
});

const commonImageValidation = (isRequired = true) => {
  let schema = joi.any().custom((value, helpers) => {
    if (!value) return value;
    if (typeof value === 'string') return value; // Already uploaded filename or empty string

    // Multer gives an object or array of objects
    const file = Array.isArray(value) ? value[0] : value;
    if (!file.mimetype || !file.size) return value; // Not a file object

    const FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const SUPPORTED_FORMATS = [
      'image/jpg',
      'image/jpeg',
      'image/png',
      'image/svg+xml',
    ];

    if (file.size > FILE_SIZE) {
      return helpers.message('File size must be less than 20MB');
    }
    if (!SUPPORTED_FORMATS.includes(file.mimetype)) {
      return helpers.message('Only JPG, PNG, SVG allowed');
    }
    return value;
  });

  return isRequired ? schema.required() : schema.optional().allow('', null);
};

const schoolRegisterSchema = joi.object({
  id: joistring.optional().allow(''),
  schoolName: joistring.required().label('School name'),
  ownerName: joistring.required().label('Owner name'),
  email: joistring.email().required().label('Email'),
  phoneNumber: joistring.required().label('Phone number'),
  schoolCode: joistring.required().label('School code'),
  address: joistring.required().label('Address'),
  country: joistring.required().label('Country'),
  state: joistring.required().label('State'),
  city: joistring.required().label('City'),
  zipCode: joistring.required().label('Zip Code'),
  board: joistring
    .valid('CBSE', 'GSEB', 'ICSE', 'IB', 'Other')
    .required()
    .label('Board'),
  schoolType: joistring
    .valid('Private', 'Government', 'Trust', 'Other')
    .required()
    .label('School Type'),
  medium: joistring
    .valid('English', 'Gujarati', 'Hindi', 'Other')
    .required()
    .label('Medium'),
  establishedYear: joi.date().required().label('Established Year'),
  registrationNumber: joistring.required().label('Registration Number'),
  gstNumber: joistring.optional().allow('').label('GST Number'),
  panNumber: joistring.optional().allow('').label('PAN Number'),
  latitude: joi.number().optional().allow(null, '').label('Latitude'),
  longitude: joi.number().optional().allow(null, '').label('Longitude'),
  logo: joi
    .any()
    .when('id', {
      is: joi.exist().not(''),
      then: commonImageValidation(false),
      otherwise: commonImageValidation(true),
    })
    .label('Logo'),
  banner: commonImageValidation(false).label('Banner'),
  affiliationCertificate: commonImageValidation(false).label(
    'Affiliation Certificate'
  ),
  password: joiPassword
    .string()
    .min(8)
    .minOfUppercase(1)
    .minOfLowercase(1)
    .minOfNumeric(1)
    .minOfSpecialCharacters(1)
    .noWhiteSpaces()
    .when('id', {
      is: joi.exist().not(''),
      then: joi.optional().allow('', null),
      otherwise: joi.required(),
    })
    .label('Password'),
});

const schoolVerifyEmailSchema = joi.object({
  email: joistring.email().required().label('Email'),
  otp: joistring.required().length(6).label('OTP'),
});

const getSchoolImageSchema = joi.object({
  schoolCode: joistring.required().label('School Code'),
  page: joistring.optional().allow('').label('Page'),
});

const schoolResendOtpSchema = joi.object({
  email: joistring.email().required().label('Email'),
});

const schoolUpdateProfileSchema = joi.object({
  schoolName: joistring.optional().label('School name'),
  ownerName: joistring.optional().label('Owner name'),
  email: joistring.optional().email().label('Email'),
  phoneNumber: joistring.optional().label('Phone number'),
  schoolCode: joistring.optional().label('School code'),
  address: joistring.optional().allow('').label('Address'),
  city: joistring.optional().allow('').label('City'),
  state: joistring.optional().allow('').label('State'),
  zipCode: joistring.optional().allow('').label('Zip Code'),
  country: joistring.optional().allow('').label('Country'),
  board: joistring
    .optional()
    .valid('CBSE', 'GSEB', 'ICSE', 'IB', 'Other')
    .label('Board'),
  schoolType: joistring
    .optional()
    .valid('Private', 'Government', 'Trust', 'Other')
    .label('School Type'),
  medium: joistring
    .optional()
    .valid('English', 'Gujarati', 'Hindi', 'Other')
    .label('Medium'),
  establishedYear: joi.date().optional().label('Established Year'),
  registrationNumber: joistring.optional().label('Registration Number'),
  gstNumber: joistring.optional().allow('').label('GST Number'),
  panNumber: joistring.optional().allow('').label('PAN Number'),
  latitude: joi.number().optional().allow(null, '').label('Latitude'),
  longitude: joi.number().optional().allow(null, '').label('Longitude'),
  logo: commonImageValidation(false).label('Logo'),
  banner: commonImageValidation(false).label('Banner'),
  affiliationCertificate: commonImageValidation(false).label(
    'Affiliation Certificate'
  ),
});

const adminVerifyRegistrationOtpSchema = joi.object({
  email: joistring.email().required().label('Email'),
  otp: joistring.required().length(6).label('OTP'),
  school_id: joistring.required().label('School ID'),
});

const developerLoginSchema = joi.object().keys({
  email: joistring.email().required().label('Email'),
  password: joistring.required().label('Password'),
});

const developerForgotPasswordSchema = joi.object().keys({
  email: joistring.email().required().label('Email'),
});

const developerResetPasswordSchema = joi.object().keys({
  email: joistring.email().required().label('Email'),
  newPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'New password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'New password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'New password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'New password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'New password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'New password must be at least 8 characters long.',
    })
    .required()
    .label('New password'),

  confirmPassword: joiPassword
    .string()
    .minOfSpecialCharacters(1)
    .messages({
      'password.minOfSpecialCharacters':
        'Confirm password must include at least one special character.',
    })
    .minOfLowercase(1)
    .messages({
      'password.minOfLowercase':
        'Confirm password must include at least one lowercase letter.',
    })
    .minOfUppercase(1)
    .messages({
      'password.minOfUppercase':
        'Confirm password must include at least one uppercase letter.',
    })
    .minOfNumeric(1)
    .messages({
      'password.minOfNumeric':
        'Confirm password must include at least one numeric digit.',
    })
    .noWhiteSpaces()
    .messages({
      'password.noWhiteSpaces': 'Confirm password must not contain whitespace.',
    })
    .min(8)
    .messages({
      'password.min': 'Confirm password must be at least 8 characters long.',
    })
    .required()
    .label('Confirm password'),
});

const developerUpdateProfileSchema = joi.object({
  name: joistring.optional().label('Name'),
  email: joistring.optional().email().label('Email'),
  phoneNumber: joistring.optional().label('Phone number'),
  address: joistring.optional().allow('').label('Address'),
  imageUrl: commonImageValidation(false).label('Image'),
});

const adminVerifyLoginOtpSchema = joi.object({
  email: joistring.email().required().label('Email'),
  otp: joistring.required().length(6).label('OTP'),
  schoolCode: joi.string().required().label('School Code'),
});

const developerVerifyOtpCommonSchema = joi.object({
  email: joistring.email().required().label('Email'),
  otp: joistring.required().length(6).label('OTP'),
  type: joistring
    .valid(
      'login',
      'registration',
      'forgotPassword',
      'schoolRegistration',
      'developer_email_change'
    )
    .required()
    .label('Type'),
});

const developerSendOtpCommonSchema = joi.object({
  email: joistring.email().required().label('Email'),
  type: joistring
    .valid(
      'login',
      'registration',
      'forgotPassword',
      'schoolRegistration',
      'developer_email_change'
    )
    .required()
    .label('Type'),
});

const adminVerifyOtpCommonSchema = joi.object({
  email: joistring.email().required().label('Email'),
  otp: joistring.required().length(6).label('OTP'),
  type: joistring
    .valid('login', 'registration', 'forgotPassword', 'admin_email_change')
    .required()
    .label('Type'),
  schoolCode: joistring.optional().label('School Code'),
  school_id: joistring.optional().label('School ID'),
});

const adminSendOtpCommonSchema = joi.object({
  email: joistring.email().required().label('Email'),
  type: joistring
    .valid('login', 'registration', 'forgotPassword', 'admin_email_change')
    .required()
    .label('Type'),
  schoolCode: joistring.optional().label('School Code'),
  school_id: joistring.optional().label('School ID'),
});

export default {
  adminLoginSchema,
  changePasswordSchema,
  adminForgotPasswordSchema,
  adminResetPasswordSchema,
  schoolRegisterSchema,
  schoolVerifyEmailSchema,
  schoolResendOtpSchema,
  schoolUpdateProfileSchema,
  adminVerifyRegistrationOtpSchema,
  developerLoginSchema,
  developerForgotPasswordSchema,
  developerResetPasswordSchema,
  developerUpdateProfileSchema,
  adminVerifyLoginOtpSchema,
  developerVerifyOtpCommonSchema,
  developerSendOtpCommonSchema,
  getSchoolImageSchema,
  adminVerifyOtpCommonSchema,
  adminSendOtpCommonSchema,
};

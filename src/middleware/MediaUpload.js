import multer from 'multer';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import { responseMessage } from '../utils/ResponseMessage.js';
import Logger from '../utils/Logger.js';
import { ResponseHandler } from '../services/CommonServices.js';

const logger = new Logger('src/middleware/MediaUpload.js');

//#region Allowed extensions
const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'svg'];
const allowedVideoExtensions = ['mp4', 'mov', 'avi', 'mkv'];
const allowedPdfExtensions = ['pdf'];
const allowedExtensions = [
  ...allowedImageExtensions,
  ...allowedVideoExtensions,
  ...allowedPdfExtensions,
];
//#endregion

//#region Validate extension
function isValidMediaExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
}
//#endregion

//#region Storage config
const uploadPath = './public/uploads';

const storage = multer.diskStorage({
  destination(_, __, callback) {
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    callback(null, uploadPath);
  },
  filename(_, file, callback) {
    const ext = file.originalname.split('.').pop();
    callback(null, `${Date.now()}.${ext}`);
  },
});
//#endregion

const fieldsArray = [
  { name: 'imageUrl', maxCount: 1 },
  { name: 'logoUrl', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'affiliationCertificate', maxCount: 1 },
  { name: 'videoUrl', maxCount: 1 },
  { name: 'pdfUrl', maxCount: 1 },
  { name: 'multipleImageUrl', maxCount: 10 },
  { name: 'bluePrintpdfUrl', maxCount: 20 },
];

//#region Main Middleware Factory
export const MediaUpload = () => {
  const upload = multer({
    storage,
    limits: {
      fileSize: 1000 * 1024 * 1024, // 100MB
    },
  }).fields(fieldsArray);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        logger.error(err);
        return ResponseHandler(res, StatusCodes.BAD_REQUEST, err.message, null);
      }

      // ✅ Initialize arrays before using .push()
      const uploadedFiles = req.files || {};
      req.multipleImageUrl = [];
      req.bluePrintpdfUrlArray = [];

      for (const fieldName in uploadedFiles) {
        const files = uploadedFiles[fieldName];

        for (const file of files) {
          if (!isValidMediaExtension(file.originalname)) {
            logger.error(responseMessage.INVALID_FILE_EXTENSION);
            return ResponseHandler(
              res,
              StatusCodes.BAD_REQUEST,
              responseMessage.INVALID_FILE_EXTENSION,
              null
            );
          }

          switch (fieldName) {
            case 'imageUrl':
              req.imageUrl = file.filename;
              break;
            case 'logoUrl':
              req.logoUrl = file.filename;
              break;
            case 'logo':
              req.logo = file.filename;
              break;
            case 'banner':
              req.banner = file.filename;
              break;
            case 'affiliationCertificate':
              req.affiliationCertificate = file.filename;
              break;
            case 'videoUrl':
              req.videoUrl = file.filename;
              break;
            case 'pdfUrl':
              req.pdfUrl = file.filename;
              break;
            case 'multipleImageUrl':
              req.multipleImageUrl.push(file.filename);
              break;
            case 'bluePrintpdfUrl':
              req.bluePrintpdfUrlArray.push(file.filename);
              break;
            default:
              break;
          }
        }
      }

      next();
    });
  };
};
//#endregion

export default MediaUpload;

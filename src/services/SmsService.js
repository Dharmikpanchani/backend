import dotenv from 'dotenv';
import Logger from '../utils/Logger.js';

dotenv.config();
const logger = new Logger('src/services/SmsService.js');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;

/**
 * Send OTP via MSG91
 * @param {string} phoneNumber - Mobile number with country code (e.g., 919876543210)
 * @param {string} otp - The OTP code to send
 * @param {string} templateId - The specific MSG91 Template ID to use
 */
export const sendOtpSms = async (phoneNumber, otp, templateId) => {
  try {
    if (!MSG91_AUTH_KEY || !templateId) {
      throw new Error(`MSG91 credentials or templateId are missing`);
    }

    // MSG91 OTP Send API
    const cleanPhone = phoneNumber.replace('+', '');
    const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${cleanPhone}&authkey=${MSG91_AUTH_KEY}&otp=${otp}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.type === 'success') {
      logger.info(`[MSG91 OTP SENT to ${phoneNumber}]: Success`);
      return { success: true, data };
    } else {
      logger.error(`MSG91 API Error: ${data.message || 'Unknown error'}`);
      return { success: false, error: data.message };
    }
  } catch (error) {
    logger.error('Failed to send MSG91 OTP:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Plan Expiry SMS via MSG91 Flow API
 * @param {string} phoneNumber
 * @param {string} schoolName
 * @param {string} expiryDate
 */
export const sendSms = async (phoneNumber, schoolName, expiryDate) => {
  try {
    const templateId = process.env.MSG91_EXPIRY_TEMPLATE_ID;
    if (!MSG91_AUTH_KEY || !templateId) {
      // Fallback to mock if not configured
      logger.info(
        `[MOCK SMS] Plan expiry for ${schoolName} to ${phoneNumber} on ${expiryDate}`
      );
      return { success: true, mock: true };
    }

    const cleanPhone = phoneNumber.replace('+', '');

    // Flow API is for Transactional/Notification messages with variables
    const url = `https://control.msg91.com/api/v5/flow/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        recipients: [
          {
            mobiles: cleanPhone,
            var1: schoolName,
            var2: expiryDate,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.type === 'success') {
      logger.info(`[MSG91 EXPIRY SENT to ${phoneNumber}]: Success`);
      return { success: true };
    } else {
      logger.error(`MSG91 Flow API Error: ${data.message || 'Unknown error'}`);
      return { success: false, error: data.message };
    }
  } catch (error) {
    logger.error('Failed to send Plan Expiry SMS:', error);
    return { success: false, error: error.message };
  }
};

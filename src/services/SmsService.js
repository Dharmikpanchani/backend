import Logger from '../utils/Logger.js';

const logger = new Logger('src/services/SmsService.js');

/**
 * Mock SMS Service
 * In a production environment, this would integrate with a provider like Twilio, AWS SNS, etc.
 */
export const sendSms = async (phoneNumber, message) => {
  try {
    // 🔥 Simulation: Logging the SMS content to the terminal
    logger.info(`[SMS SENT to ${phoneNumber}]: ${message}`);

    // You can also print it to standard console for easier visibility in dev
    logger.info(`\n---------------------------------`);
    logger.info(`📱 SMS GATEWAY (MOCK)`);
    logger.info(`To: ${phoneNumber}`);
    logger.info(`Message: ${message}`);
    logger.info(`---------------------------------\n`);

    return { success: true };
  } catch (error) {
    logger.error('Failed to send SMS:', error);
    return { success: false, error: error.message };
  }
};

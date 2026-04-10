import crypto from 'crypto';
import redis from '../config/Redis.config.js';
import Logger from '../utils/Logger.js';
import { responseMessage } from '../utils/ResponseMessage.js';

const logger = new Logger('src/services/OtpService.js');

const OTP_TTL = 300; // 5 minutes in seconds
const MAX_ATTEMPTS = 5;

//#region Generate secure 6-digit OTP
export const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};
//#endregion

//#region Store OTP in Redis
// key format: otp:{type}:{identifier}  e.g. otp:admin:test@mail.com
export const storeOtp = async (type, identifier, otp) => {
  const key = `otp:${type}:${identifier}`;
  const attemptsKey = `otp_attempts:${type}:${identifier}`;

  await redis.setex(key, OTP_TTL, otp);
  // Reset attempt counter when new OTP is issued
  await redis.setex(attemptsKey, OTP_TTL, '0');
  logger.info(`OTP stored for ${type}:${identifier}`);
};
//#endregion

//#region Verify OTP from Redis
export const verifyOtp = async (type, identifier, inputOtp) => {
  const blockKey = `otp_block:${type}:${identifier}`;
  const isBlocked = await redis.get(blockKey);
  if (isBlocked) {
    const ttl = await redis.ttl(blockKey);
    const minutes = Math.ceil(ttl / 60);
    return {
      success: false,
      message: `You are blocked due to too many failed attempts. Please try again after ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      maxAttemptsReached: true,
    };
  }

  const key = `otp:${type}:${identifier}`;
  const attemptsKey = `otp_attempts:${type}:${identifier}`;

  const storedOtp = await redis.get(key);

  if (!storedOtp) {
    const attempts = await redis.get(attemptsKey);
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      return {
        success: false,
        message: 'Too many wrong OTP attempts. Please request a new OTP.',
        maxAttemptsReached: true,
      };
    }
    return { success: false, message: responseMessage.OTP_EXPIRED };
  }

  if (storedOtp === inputOtp.toString()) {
    // OTP matched — delete from Redis
    await deleteOtp(type, identifier);
    return { success: true, message: 'OTP verified successfully' };
  }

  // OTP didn't match — Increment attempt counter
  const attempts = await redis.incr(attemptsKey);

  if (attempts >= MAX_ATTEMPTS) {
    await redis.setex(blockKey, 900, '1'); // 15 mins block
    await deleteOtp(type, identifier, false);
    return {
      success: false,
      message: 'Too many wrong OTP attempts. You are blocked for 15 minutes.',
      maxAttemptsReached: true,
    };
  }

  const remaining = MAX_ATTEMPTS - attempts;
  return {
    success: false,
    message: `${responseMessage.INVALID_OTP}. ${remaining === 1 ? 'Last' : remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
  };
};
//#endregion

//#region Delete OTP from Redis
export const deleteOtp = async (type, identifier, keepAttempts = false) => {
  const key = `otp:${type}:${identifier}`;
  const attemptsKey = `otp_attempts:${type}:${identifier}`;
  await redis.del(key);
  if (!keepAttempts) {
    await redis.del(attemptsKey);
  }
};
//#endregion

//#region Check OTP rate limit (max 10 OTP requests per 5 min)
export const checkOtpRateLimit = async (type, identifier) => {
  const blockKey = `otp_block:${type}:${identifier}`;
  const isBlocked = await redis.get(blockKey);
  if (isBlocked) {
    const ttl = await redis.ttl(blockKey);
    const minutes = Math.ceil(ttl / 60);
    return {
      limited: true,
      message: `You are blocked due to too many failed attempts. Please try again after ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    };
  }

  const reqBlockKey = `otp_req_block:${type}:${identifier}`;
  const isReqBlocked = await redis.get(reqBlockKey);
  if (isReqBlocked) {
    const ttl = await redis.ttl(reqBlockKey);
    const minutes = Math.ceil(ttl / 60);
    return {
      limited: true,
      message: `Too many OTP requests. Please wait ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    };
  }

  const rateLimitKey = `otp_rate:${type}:${identifier}`;
  const count = await redis.incr(rateLimitKey);

  if (count === 1) {
    await redis.expire(rateLimitKey, 300); // 5 minute window
  }

  if (count > 10) {
    await redis.setex(reqBlockKey, 300, '1'); // 5 minute block
    return {
      limited: true,
      message: `Too many OTP requests. Please wait 5 minutes.`,
    };
  }

  return { limited: false };
};
//#endregion

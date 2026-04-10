import jwt from 'jsonwebtoken';
import config from '../config/Index.js';

//#region Generate Access Token (short-lived)
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET_KEY, {
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });
};
//#endregion

//#region Generate Refresh Token (long-lived)
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRY,
  });
};
//#endregion

//#region Verify Any Token
export const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};
//#endregion

//#region Set Refresh Token Cookie (HttpOnly, Secure)
export const setRefreshTokenCookie = (res, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};
//#endregion

//#region Clear Refresh Token Cookie
export const clearRefreshTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 0,
  });
};
//#endregion

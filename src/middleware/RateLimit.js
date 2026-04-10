import rateLimit from 'express-rate-limit';

//#region General API Rate Limiter
export const apiLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 3 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message:
      'Too many requests created from this IP, please try again after 3 minutes',
  },
});
//#endregion

//#region Auth Specific Rate Limiter (Login, Register etc)
export const authLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutes
  max: 20, // Limit each IP to 20 requests per `window` for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many authentication attempts from this IP, please try again after 3 minutes',
  },
});
//#endregion

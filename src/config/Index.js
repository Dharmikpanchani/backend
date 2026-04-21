import dotenv from 'dotenv';
import moment from 'moment';
dotenv.config();

const config = {
  PORT: process.env.PORT || 8000,
  MONGO_URL: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_APP_PASS: process.env.EMAIL_APP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,

  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '1m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  BASE_URL: process.env.BASE_URL,

  SUPER_ADMIN: 'super_developer',
  DEVELOPER: 'developer',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  // FIRST_PLAN_EXPIRY: () => moment().add(1, 'month').unix(),
  FIRST_PLAN_EXPIRY: () => moment().add(1, 'hour').unix(),
};

export default config;

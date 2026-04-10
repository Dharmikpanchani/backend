import nodemailer from 'nodemailer';
import config from './Index.js';
import Logger from '../utils/Logger.js';

const logger = new Logger('./src/config/Email.config.js');

const transporter = nodemailer.createTransport({
  service: 'gmail', // ✅ IMPORTANT
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_APP_PASS,
  },
});

// debug
transporter.verify((err) => {
  if (err) {
    logger.error(`❌ Mail Error: ${err}`);
  }
});

export default transporter;

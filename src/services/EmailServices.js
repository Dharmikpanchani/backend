import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/Index.js';
import Logger from '../utils/Logger.js';
const logger = new Logger('src/services/EmailServices.js');
import transporter from '../config/Email.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function sendRegisterVerificationEmail(otp, email, type, action) {
  try {
    const templatePath = path.join(__dirname, '../views/Register.ejs');

    const emailTemplate = await ejs.renderFile(templatePath, {
      otp,
      type,
      action,
    });

    const mailOptions = {
      from: `"${type} App" <${config.EMAIL_FROM}>`, // ✅ fix
      to: email,
      subject: `${type} ${action} OTP Notification`,
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`OTP email sent successfully to ${email}`);
  } catch (error) {
    logger.error(`Error sending OTP email: ${error}`);
  }
}

export async function forgotPasswordOtpMail(email, otp) {
  try {
    const templatePath = path.join(__dirname, '../views/ForgotPassword.ejs');

    const emailTemplate = await ejs.renderFile(templatePath, { otp });

    const mailOptions = {
      from: config.EMAIL_FROM,
      to: email,
      subject: 'Forgot Password OTP Verification',
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    if (!info?.messageId) {
      throw new Error('Failed to send email');
    }
    logger.info(`OTP email sent successfully to ${email}`);
    return { success: true, message: 'OTP email sent successfully' };
  } catch (error) {
    logger.error(`Error sending OTP email: ${error}`);
    return {
      success: false,
      message: 'Failed to send OTP email',
      error: error.message,
    };
  }
}

export async function sendSubscriptionBaseMail(description, email) {
  try {
    if (!email) {
      throw new Error('No recipient email provided');
    }

    const templatePath = path.join(__dirname, '../views/Reffrance.ejs');

    // Render EJS template with dynamic description
    const emailTemplate = await ejs.renderFile(templatePath, { description });

    const mailOptions = {
      from: config.EMAIL_FROM,
      to: email, // send to multiple recipients
      subject: 'Referral Notification',
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    if (!info?.messageId) {
      throw new Error('Failed to send subscription email');
    }

    logger.info(`Subscription email sent successfully to: ${email}`);
    return { success: true, message: 'Subscription email sent successfully' };
  } catch (error) {
    logger.error(`Error sending subscription email: ${error}`);
    return {
      success: false,
      message: 'Failed to send subscription email',
      error: error.message,
    };
  }
}

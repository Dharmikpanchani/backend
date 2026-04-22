import { Router } from 'express';
import * as PaymentController from '../controller/PaymentController.js';
import { adminAuth, schoolScope } from '../middleware/Auth.js';

const paymentRoutes = Router();

paymentRoutes.post(
  '/create-school-plan',
  adminAuth,
  schoolScope,
  PaymentController.createSchoolPlan
);
paymentRoutes.post(
  '/verify',
  adminAuth,
  schoolScope,
  PaymentController.verifyPayment
);
paymentRoutes.post('/webhook', PaymentController.razorpayWebhook);
paymentRoutes.get(
  '/transactions',
  adminAuth,
  schoolScope,
  PaymentController.getTransactions
);
paymentRoutes.post(
  '/pay-salary',
  adminAuth,
  schoolScope,
  PaymentController.payTeacherSalary
);

export default paymentRoutes;

// https://www.postman.com/razorpaydev/razorpay-public-workspace/folder/vhoz1js/amazon-payout-wallet?sideView=agentMode

import { Router } from 'express';
import adminRoutes from './SchoolAdminRoutes.js';
import userRoutes from './UserRoutes.js';
import developerRoutes from './DeveloperAdminRoutes.js';
import paymentRoutes from './PaymentRoutes.js';

const router = Router();
router.use('/developer', developerRoutes);
router.use('/admin', adminRoutes);
router.use('/user', userRoutes);
router.use('/payment', paymentRoutes);
export default router;

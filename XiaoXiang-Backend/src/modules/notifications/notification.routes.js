import express from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../common/middlewares/auth.js';

const router = express.Router();

/**
 * @route   POST /api/notifications/push-token
 * @desc    保存用户的 Expo Push Token
 * @access  Private (需要认证)
 */
router.post('/push-token', authenticate, NotificationController.savePushToken);

export default router;

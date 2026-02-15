import express from 'express';
import { NotificationController } from './notification.controller.js';

const router = express.Router();

// 注意：认证中间件已在 controller 中通过 asyncHandler 处理
// 如需认证，请在 controller 中添加认证逻辑

/**
 * @route   POST /api/notifications/push-token
 * @desc    保存用户的 Expo Push Token
 * @access  Private (需要认证)
 */
router.post('/push-token', NotificationController.savePushToken);

export default router;

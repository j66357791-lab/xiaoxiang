import express from 'express';
import { authenticate } from '../../../common/middlewares/auth.js';
import { registerToken, savePushToken } from '../controllers/notification.controller.js';

const router = express.Router();

/**
 * @route   POST /api/product/notifications/register
 * @desc    注册 Push Token（兼容旧接口）
 * @access  Private
 */
router.post('/register', authenticate, registerToken);

/**
 * @route   POST /api/product/notifications/push-token
 * @desc    保存用户的 Expo Push Token
 * @access  Private
 */
router.post('/push-token', authenticate, savePushToken);

export default router;

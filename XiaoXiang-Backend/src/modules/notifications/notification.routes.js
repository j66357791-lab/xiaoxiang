import express from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../common/middlewares/auth.js';

const router = express.Router();

// 所有通知路由都需要认证
router.use(authenticate);

/**
 * @route   POST /api/notifications/push-token
 * @desc    保存用户的 Expo Push Token
 * @access  Private
 */
router.post('/push-token', NotificationController.savePushToken);

/**
 * @route   GET /api/notifications
 * @desc    获取用户通知列表
 * @access  Private
 */
router.get('/', NotificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    获取未读通知数量
 * @access  Private
 */
router.get('/unread-count', NotificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    全部标记已读
 * @access  Private
 */
router.put('/read-all', NotificationController.markAllAsRead);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    标记单条通知为已读
 * @access  Private
 */
router.put('/:id/read', NotificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    删除通知
 * @access  Private
 */
router.delete('/:id', NotificationController.deleteNotification);

export default router;

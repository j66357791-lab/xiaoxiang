import { success, error } from '../../common/utils/response.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { NotificationService } from './notification.service.js';

/**
 * 通知控制器（notifications 模块 - 完整版）
 */
export class NotificationController {

  /**
   * 保存 Push Token
   * POST /api/notifications/push-token
   */
  static savePushToken = asyncHandler(async (req, res) => {
    const { pushToken } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return error(res, '未登录，请先登录', 401);
    }

    if (!pushToken) {
      return error(res, 'pushToken 不能为空', 400);
    }

    // 验证 token 格式
    if (!pushToken.startsWith('ExponentPushToken[')) {
      return error(res, 'pushToken 格式不正确', 400);
    }

    await NotificationService.savePushToken(userId, pushToken);
    console.log(`[Notification] 用户 ${userId} 的 Push Token 已保存`);
    return success(res, null, 'Push Token 保存成功');
  });

  /**
   * 获取通知列表
   * GET /api/notifications
   */
  static getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { page = 1, limit = 20 } = req.query;

    if (!userId) {
      return error(res, '未登录，请先登录', 401);
    }

    const result = await NotificationService.getUserNotifications(userId, page, limit);
    return success(res, result);
  });

  /**
   * 获取未读通知数量
   * GET /api/notifications/unread-count
   */
  static getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
      return error(res, '未登录，请先登录', 401);
    }

    const count = await NotificationService.getUnreadCount(userId);
    return success(res, { unreadCount: count });
  });

  /**
   * 标记单条通知为已读
   * PUT /api/notifications/:id/read
   */
  static markAsRead = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return error(res, '未登录，请先登录', 401);
    }

    const notification = await NotificationService.markAsRead(id, userId);

    if (!notification) {
      return error(res, '通知不存在', 404);
    }

    return success(res, notification, '已标记为已读');
  });

  /**
   * 全部标记为已读
   * PUT /api/notifications/read-all
   */
  static markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
      return error(res, '未登录，请先登录', 401);
    }

    const result = await NotificationService.markAllAsRead(userId);
    return success(res, result, `已将 ${result.modifiedCount} 条通知标记为已读`);
  });

  /**
   * 删除通知
   * DELETE /api/notifications/:id
   */
  static deleteNotification = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return error(res, '未登录，请先登录', 401);
    }

    const notification = await NotificationService.deleteNotification(id, userId);

    if (!notification) {
      return error(res, '通知不存在', 404);
    }

    return success(res, null, '通知已删除');
  });
}

export default NotificationController;

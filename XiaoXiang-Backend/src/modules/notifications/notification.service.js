import Notification from './notification.model.js';
import User from '../users/user.model.js';
import { sendPushNotification } from '../../common/utils/push.js';

/**
 * 通知服务
 * 处理通知的创建、发送、查询等业务逻辑
 */
export class NotificationService {
  
  /**
   * 保存用户的 Push Token
   * @param {string} userId - 用户ID
   * @param {string} pushToken - Expo Push Token
   */
  static async savePushToken(userId, pushToken) {
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        pushToken,
        pushTokenUpdatedAt: new Date()
      },
      { new: true }
    );
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    console.log(`[NotificationService] 用户 ${userId} 的 Push Token 已更新`);
    return { success: true, message: 'Push Token 保存成功' };
  }

  /**
   * 创建并发送通知
   * @param {string} userId - 接收通知的用户ID
   * @param {string} title - 通知标题
   * @param {string} body - 通知内容
   * @param {string} type - 通知类型
   * @param {object} data - 额外数据
   */
  static async createAndSend(userId, title, body, type = 'system', data = {}) {
    // 1. 创建通知记录
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      data,
      pushStatus: 'pending'
    });

    // 2. 获取用户的 pushToken
    const user = await User.findById(userId).select('pushToken notificationEnabled');
    
    // 3. 发送推送通知
    if (user && user.pushToken && user.notificationEnabled !== false) {
      const result = await sendPushNotification(
        user.pushToken,
        title,
        body,
        {
          type,
          notificationId: notification._id.toString(),
          ...data
        }
      );
      
      // 更新推送状态
      notification.pushStatus = result.success ? 'sent' : 'failed';
      if (!result.success) {
        notification.pushError = result.error;
      }
      await notification.save();
    } else {
      // 用户没有 pushToken 或关闭了通知
      notification.pushStatus = 'failed';
      notification.pushError = user?.notificationEnabled === false ? '用户已关闭通知' : '用户没有 Push Token';
      await notification.save();
    }

    console.log(`[NotificationService] 通知已创建并发送: ${title}`);
    return notification;
  }

  /**
   * 获取用户通知列表
   * @param {string} userId - 用户ID
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   */
  static async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false })
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 标记通知为已读
   * @param {string} notificationId - 通知ID
   * @param {string} userId - 用户ID
   */
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );
    
    return notification;
  }

  /**
   * 全部标记已读
   * @param {string} userId - 用户ID
   */
  static async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );
    
    return { modifiedCount: result.modifiedCount };
  }

  /**
   * 删除通知
   * @param {string} notificationId - 通知ID
   * @param {string} userId - 用户ID
   */
  static async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });
    
    return notification;
  }

  /**
   * 获取未读通知数量
   * @param {string} userId - 用户ID
   */
  static async getUnreadCount(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  }

  /**
   * 发送接单成功通知
   * @param {string} userId - 用户ID
   * @param {string} orderId - 订单ID
   * @param {string} jobTitle - 任务标题
   */
  static async sendOrderAcceptedNotification(userId, orderId, jobTitle) {
    return this.createAndSend(
      userId,
      '接单成功',
      `亲爱的小象用户，恭喜您已经成功接单任务，可前往个人中心我的订单页面处进行查看。`,
      'order',
      { orderId, action: 'view_order' }
    );
  }

  /**
   * 发送订单状态更新通知
   * @param {string} userId - 用户ID
   * @param {string} orderId - 订单ID
   * @param {string} status - 新状态
   * @param {string} message - 通知内容
   */
  static async sendOrderStatusNotification(userId, orderId, status, message) {
    const statusTitles = {
      'Submitted': '订单已提交',
      'Reviewing': '订单审核中',
      'PendingPayment': '审核通过，待打款',
      'Completed': '订单已完成',
      'Rejected': '订单已驳回',
      'Cancelled': '订单已取消'
    };

    return this.createAndSend(
      userId,
      statusTitles[status] || '订单状态更新',
      message,
      'order',
      { orderId, status }
    );
  }
}

export default NotificationService;

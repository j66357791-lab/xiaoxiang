import { success } from '../../common/utils/response.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import User from '../users/user.model.js';

/**
 * 通知控制器（简化版 - 只保存 Token，不存通知记录）
 */
export class NotificationController {
  
  /**
   * 保存 Push Token
   * POST /api/notifications/push-token
   */
  static savePushToken = asyncHandler(async (req, res) => {
    const { pushToken } = req.body;
    
    // 从请求中获取用户ID（需要配合认证中间件）
    const userId = req.user?._id || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未登录，请先登录'
      });
    }

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'pushToken 不能为空'
      });
    }

    // 验证 token 格式
    if (!pushToken.startsWith('ExponentPushToken[')) {
      return res.status(400).json({
        success: false,
        message: 'pushToken 格式不正确'
      });
    }

    // 直接更新用户的 pushToken
    await User.findByIdAndUpdate(userId, {
      pushToken,
      pushTokenUpdatedAt: new Date()
    });

    console.log(`[Notification] 用户 ${userId} 的 Push Token 已保存`);

    return success(res, null, 'Push Token 保存成功');
  });
}

export default NotificationController;

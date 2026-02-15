import PushToken from '../models/pushToken.model.js';
import User from '../../users/user.model.js';
import { sendPushNotification } from '../../../common/utils/push.js';

/**
 * 通知服务（简化版 - 用于向管理员发送通知）
 */
export const notifyAdmins = async (title, body, data = {}) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'superAdmin'] } }).select('_id');
    if (!admins.length) return;

    const adminIds = admins.map(u => u._id);
    const tokens = await PushToken.find({ userId: { $in: adminIds } }).select('token');
    if (!tokens.length) return;

    // 正确调用 sendPushNotification，传入分开的参数
    for (let t of tokens) {
      await sendPushNotification(t.token, title, body, data);
    }
    console.log(`[通知] 已发送: ${title}`);
  } catch (error) {
    console.error('[通知] 发送失败:', error);
  }
};

export const savePushToken = async (userId, token, platform) => {
  await PushToken.findOneAndUpdate(
    { userId },
    { token, platform },
    { upsert: true, new: true }
  );
};

export default {
  notifyAdmins,
  savePushToken
};

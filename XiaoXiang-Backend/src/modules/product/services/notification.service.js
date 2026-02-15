import PushToken from '../models/pushToken.model.js';
import User from '../../users/user.model.js';
// 引用您已有的 push 工具
import { sendPushNotification } from '../../../common/utils/push.js';

export const notifyAdmins = async (title, body, data = {}) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'superAdmin'] } }).select('_id');
    if (!admins.length) return;

    const adminIds = admins.map(u => u._id);
    const tokens = await PushToken.find({ userId: { $in: adminIds } }).select('token');
    if (!tokens.length) return;

    const messages = tokens.map(t => ({ to: t.token, title, body, data, sound: 'default' }));

    // 兼容处理：如果您的 push.js 支持批量则直接传，否则循环
    // 假设 sendPushNotification 接受单个消息对象
    for (let msg of messages) {
      await sendPushNotification(msg);
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

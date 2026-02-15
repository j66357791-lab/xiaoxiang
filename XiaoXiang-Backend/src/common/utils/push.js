/**
 * Expo 推送通知工具
 * 用于向移动端发送推送通知
 * 
 * 使用方法：
 * import { sendPushNotification } from './push.js';
 * await sendPushNotification(pushToken, '标题', '内容', { orderId: '123' });
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * 发送单个推送通知
 * @param {string} pushToken - Expo Push Token (格式: ExponentPushToken[xxxxxx])
 * @param {string} title - 通知标题
 * @param {string} body - 通知内容
 * @param {object} data - 额外数据（点击通知时使用，用于跳转页面）
 * @param {object} options - 其他选项
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function sendPushNotification(pushToken, title, body, data = {}, options = {}) {
  // 验证 token 格式
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
    console.log('[Push] 无效的 Push Token:', pushToken);
    return { success: false, error: '无效的 Push Token' };
  }

  const message = {
    to: pushToken,
    sound: options.sound || 'default',
    title,
    body,
    data,
    priority: options.priority || 'high',
    channelId: options.channelId || 'default',
    badge: options.badge,
  };

  try {
    console.log(`[Push] 发送通知到 ${pushToken}: ${title}`);
    
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    // 检查是否有错误
    if (result.data && result.data.status === 'error') {
      console.error('[Push] 推送失败:', result.data.message);
      return { success: false, error: result.data.message };
    }
    
    console.log('[Push] 推送成功');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[Push] 推送请求失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 批量发送推送通知
 * @param {string[]} pushTokens - Expo Push Token 数组
 * @param {string} title - 通知标题
 * @param {string} body - 通知内容
 * @param {object} data - 额外数据
 * @param {object} options - 其他选项
 */
export async function sendBatchPushNotifications(pushTokens, title, body, data = {}, options = {}) {
  // 过滤无效 token
  const validTokens = pushTokens.filter(token => 
    token && token.startsWith('ExponentPushToken[')
  );

  if (validTokens.length === 0) {
    return { success: false, error: '没有有效的 Push Token' };
  }

  const messages = validTokens.map(token => ({
    to: token,
    sound: options.sound || 'default',
    title,
    body,
    data,
    priority: options.priority || 'high',
    channelId: options.channelId || 'default',
  }));

  try {
    console.log(`[Push] 批量发送通知到 ${validTokens.length} 个设备`);
    
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[Push] 批量推送失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 发送订单通知
 * @param {string} pushToken - 用户 Push Token
 * @param {string} orderId - 订单ID
 * @param {string} status - 订单状态
 * @param {string} message - 通知内容
 */
export async function sendOrderNotification(pushToken, orderId, status, message) {
  return sendPushNotification(
    pushToken,
    '订单状态更新',
    message,
    { type: 'order', orderId, status },
    { channelId: 'orders' }
  );
}

/**
 * 发送消息通知
 * @param {string} pushToken - 用户 Push Token
 * @param {string} conversationId - 会话ID
 * @param {string} senderName - 发送者名称
 * @param {string} message - 消息内容
 */
export async function sendMessageNotification(pushToken, conversationId, senderName, message) {
  return sendPushNotification(
    pushToken,
    senderName,
    message,
    { type: 'message', conversationId },
    { channelId: 'messages' }
  );
}

/**
 * 发送系统通知
 * @param {string} pushToken - 用户 Push Token
 * @param {string} title - 标题
 * @param {string} body - 内容
 * @param {object} data - 额外数据
 */
export async function sendSystemNotification(pushToken, title, body, data = {}) {
  return sendPushNotification(
    pushToken,
    title,
    body,
    { type: 'system', ...data },
    { channelId: 'system' }
  );
}

export default {
  sendPushNotification,
  sendBatchPushNotifications,
  sendOrderNotification,
  sendMessageNotification,
  sendSystemNotification,
};

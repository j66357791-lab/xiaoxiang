import * as service from '../services/notification.service.js';
import { success, error } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

/**
 * 通知控制器（product 模块 - 简化版）
 * 主要用于保存 Push Token 和通知管理员
 */
export const registerToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    return error(res, '未登录，请先登录', 401);
  }

  if (!token) {
    return error(res, 'token 不能为空', 400);
  }

  await service.savePushToken(userId, token, platform);
  return success(res, null, '注册成功');
});

/**
 * 保存 Push Token（兼容不同命名）
 */
export const savePushToken = asyncHandler(async (req, res) => {
  const { pushToken, platform } = req.body;
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

  await service.savePushToken(userId, pushToken, platform);
  return success(res, null, 'Push Token 保存成功');
});

export default {
  registerToken,
  savePushToken
};

import * as service from '../services/notification.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const registerToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  await service.savePushToken(req.user._id, token, platform);
  return success(res, '注册成功');
});

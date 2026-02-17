import { success, error } from '../../common/utils/response.js';
import { GiftService } from './gift.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class GiftController {
  /**
   * 获取礼包列表
   */
  static getGiftPacks = asyncHandler(async (req, res) => {
    const gifts = await GiftService.getAvailableGifts();
    return success(res, gifts, '获取礼包列表成功');
  });

  /**
   * 购买礼包
   */
  static purchaseGift = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { giftId } = req.body;

    if (!giftId) {
      return error(res, '请选择要购买的礼包', 400);
    }

    const result = await GiftService.purchaseGift(userId, giftId);
    return success(res, result, '购买成功');
  });

  /**
   * 初始化礼包（管理员）
   */
  static initGiftPacks = asyncHandler(async (req, res) => {
    const gift = await GiftService.initGiftPacks();
    return success(res, gift, '礼包初始化成功');
  });

  /**
   * 获取礼包统计（管理员）
   */
  static getGiftStats = asyncHandler(async (req, res) => {
    const { giftId } = req.params;
    const stats = await GiftService.getGiftStats(giftId);
    return success(res, stats, '获取统计成功');
  });
}

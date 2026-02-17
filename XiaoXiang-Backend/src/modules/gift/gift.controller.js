import { success, error } from '../../common/utils/response.js';
import { GiftService } from './gift.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class GiftController {
  /**
   * 获取礼包列表（用户端）
   */
  static getGiftPacks = asyncHandler(async (req, res) => {
    const gifts = await GiftService.getAvailableGifts();
    return success(res, gifts, '获取礼包列表成功');
  });

  /**
   * 获取所有礼包（管理员）
   */
  static getAllGifts = asyncHandler(async (req, res) => {
    const gifts = await GiftService.getAllGifts();
    return success(res, gifts, '获取礼包列表成功');
  });

  /**
   * 获取礼包详情
   */
  static getGiftById = asyncHandler(async (req, res) => {
    const { giftId } = req.params;
    const gift = await GiftService.getGiftById(giftId);
    return success(res, gift, '获取礼包详情成功');
  });

  /**
   * 创建新礼包（管理员）
   */
  static createGiftPack = asyncHandler(async (req, res) => {
    const data = req.body;
    const gift = await GiftService.createGiftPack(data);
    return success(res, gift, '创建礼包成功');
  });

  /**
   * 更新礼包（管理员）
   */
  static updateGiftPack = asyncHandler(async (req, res) => {
    const { giftId } = req.params;
    const data = req.body;
    const gift = await GiftService.updateGiftPack(giftId, data);
    return success(res, gift, '更新礼包成功');
  });

  /**
   * 删除礼包（管理员）
   */
  static deleteGiftPack = asyncHandler(async (req, res) => {
    const { giftId } = req.params;
    const result = await GiftService.deleteGiftPack(giftId);
    return success(res, result, '礼包已下架');
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

  /**
   * 获取所有礼包汇总统计（管理员）
   */
  static getAllGiftsStats = asyncHandler(async (req, res) => {
    const stats = await GiftService.getAllGiftsStats();
    return success(res, stats, '获取统计成功');
  });
}

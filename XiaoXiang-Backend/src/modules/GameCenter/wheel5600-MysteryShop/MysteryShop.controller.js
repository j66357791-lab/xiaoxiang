// src/modules/wheel5600-MysteryShop/MysteryShop.controller.js
import { MysteryShopService } from './MysteryShop.service.js';
import { success, error, paginated } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export class MysteryShopController {
  
  /**
   * 获取商店状态
   * GET /api/mystery-shop/status
   */
  static getStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const status = await MysteryShopService.getShopStatus(userId);
    return success(res, status, '获取商店状态成功');
  });

  /**
   * 切换场阶
   * POST /api/mystery-shop/switch-level
   */
  static switchLevel = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { level } = req.body;

    if (!level) {
      return error(res, '请选择场阶', 400);
    }

    const result = await MysteryShopService.switchLevel(userId, level);
    return success(res, result, '切换场阶成功');
  });

  /**
   * 抽奖
   * POST /api/mystery-shop/draw
   */
  static draw = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await MysteryShopService.draw(userId);
    return success(res, result, '抽奖成功');
  });

  /**
   * 获取抽奖历史
   * GET /api/mystery-shop/history
   */
  static getHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await MysteryShopService.getDrawHistory(userId, parseInt(page), parseInt(limit));
    return paginated(res, result.logs, result);
  });

  /**
   * 获取商店统计（管理员）
   * GET /api/mystery-shop/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const stats = await MysteryShopService.getShopStats();
    return success(res, stats, '获取统计成功');
  });
}

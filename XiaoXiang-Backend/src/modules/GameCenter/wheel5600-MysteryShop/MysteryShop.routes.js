// src/modules/GameCenter/mysteryShop/MysteryShop.routes.js
import { Router } from 'express';
import { MysteryShopController } from './MysteryShop.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 用户接口（需要认证）
// =====================

// 获取商店状态
router.get('/status', authenticate, asyncHandler(MysteryShopController.getStatus));

// 切换场阶
router.post('/switch-level', authenticate, asyncHandler(MysteryShopController.switchLevel));

// 抽奖
router.post('/draw', authenticate, asyncHandler(MysteryShopController.draw));

// 获取抽奖历史
router.get('/history', authenticate, asyncHandler(MysteryShopController.getHistory));

// =====================
// 管理员接口
// =====================

// 获取商店统计
router.get('/stats', authenticate, authorize('admin', 'superAdmin'), asyncHandler(MysteryShopController.getStats));

export default router;

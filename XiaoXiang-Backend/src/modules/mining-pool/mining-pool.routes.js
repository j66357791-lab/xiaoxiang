import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth.js';
import { MiningPoolController } from './mining-pool.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 公开接口（带缓存）
// =====================

// 获取矿池概览（15分钟缓存）
router.get('/overview', asyncHandler(MiningPoolController.getOverview));

// 获取今日矿池状态
router.get('/today', asyncHandler(MiningPoolController.getTodayPool));

// 获取价格历史
router.get('/price-history', asyncHandler(MiningPoolController.getPriceHistory));

// 获取详细价格走势（图表页面用）
router.get('/price-chart', asyncHandler(MiningPoolController.getDetailedPriceChart));

// 获取当前兑换价格
router.get('/exchange-rate', asyncHandler(MiningPoolController.getExchangeRate));

// 🆕 获取系统状态（检查冷却状态）
router.get('/system-status', asyncHandler(MiningPoolController.getSystemStatus));

// =====================
// 用户接口（需登录）
// =====================

// 获取用户今日投入
router.get('/my-investment', authenticate, asyncHandler(MiningPoolController.getUserInvestment));

// 获取用户投入历史
router.get('/my-history', authenticate, asyncHandler(MiningPoolController.getUserHistory));

// 投入积分
router.post('/invest', authenticate, asyncHandler(MiningPoolController.invest));

// 小象币兑换积分
router.post('/exchange', authenticate, asyncHandler(MiningPoolController.exchangeCoins));

export default router;

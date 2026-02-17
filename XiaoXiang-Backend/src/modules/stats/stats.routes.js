import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { StatsController } from './stats.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 用户端接口
// =====================

// 获取货币总览（简化版）
router.get('/currency',
  authenticate,
  asyncHandler(StatsController.getCurrencyOverview)
);

// 获取用户休闲中心流水（7天）
router.get('/leisure/transactions',
  authenticate,
  asyncHandler(StatsController.getUserLeisureTransactions)
);

// =====================
// 管理员接口
// =====================

// 获取详细货币统计
router.get('/currency/detail',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(StatsController.getCurrencyDetail)
);

// 获取货币流水明细（分页）
router.get('/currency/transactions',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(StatsController.getCurrencyTransactions)
);

// 导出货币流水Excel
router.get('/currency/export',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(StatsController.exportCurrencyTransactions)
);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { GiftController } from './gift.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 用户端接口
// =====================

// 获取礼包列表
router.get('/packs',
  authenticate,
  asyncHandler(GiftController.getGiftPacks)
);

// 购买礼包
router.post('/purchase',
  authenticate,
  asyncHandler(GiftController.purchaseGift)
);

// =====================
// 管理员接口
// =====================

// 初始化礼包
router.post('/init',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.initGiftPacks)
);

// 获取礼包统计
router.get('/stats/:giftId',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.getGiftStats)
);

export default router;

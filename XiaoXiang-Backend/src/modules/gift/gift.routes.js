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

// 获取所有礼包列表
router.get('/admin/all',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.getAllGifts)
);

// 获取所有礼包汇总统计
router.get('/admin/stats',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.getAllGiftsStats)
);

// 获取单个礼包详情
router.get('/admin/:giftId',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.getGiftById)
);

// 创建新礼包
router.post('/admin/create',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.createGiftPack)
);

// 更新礼包
router.put('/admin/:giftId',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.updateGiftPack)
);

// 删除礼包（下架）
router.delete('/admin/:giftId',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.deleteGiftPack)
);

// 获取礼包统计
router.get('/stats/:giftId',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.getGiftStats)
);

// 初始化礼包
router.post('/init',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(GiftController.initGiftPacks)
);

export default router;

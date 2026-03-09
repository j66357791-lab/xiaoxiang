// src/modules/coupons/coupon.routes.js
// 优惠券路由

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { CouponController } from './coupon.controller.js';
import { couponValidators } from './coupon.validator.js';
import { validate } from '../../common/middlewares/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ==================== 用户接口 ====================

// 获取可领取的优惠券列表
router.get('/available', 
  authenticate, 
  asyncHandler(CouponController.getAvailableCoupons)
);

// 获取我的优惠券
router.get('/my', 
  authenticate, 
  asyncHandler(CouponController.getMyCoupons)
);

// 领取优惠券
router.post('/claim/:couponId', 
  authenticate, 
  asyncHandler(CouponController.claimCoupon)
);

// 通过优惠券码领取
router.post('/claim-code', 
  authenticate, 
  validate(couponValidators.claimByCode),
  asyncHandler(CouponController.claimByCode)
);

// 验证优惠券
router.post('/validate', 
  authenticate, 
  validate(couponValidators.validateCoupon),
  asyncHandler(CouponController.validateCoupon)
);

// ==================== 管理员接口 ====================

// 获取优惠券统计
router.get('/admin/stats', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(CouponController.getCouponStats)
);

// 获取优惠券列表（管理员）
router.get('/admin', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(CouponController.getAllCoupons)
);

// 获取优惠券详情
router.get('/admin/:id', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(CouponController.getCouponById)
);

// 创建优惠券
router.post('/admin', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  validate(couponValidators.createCoupon),
  asyncHandler(CouponController.createCoupon)
);

// 更新优惠券
router.put('/admin/:id', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  validate(couponValidators.updateCoupon),
  asyncHandler(CouponController.updateCoupon)
);

// 更新优惠券状态
router.patch('/admin/:id/status', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  validate(couponValidators.updateStatus),
  asyncHandler(CouponController.updateStatus)
);

// 删除优惠券
router.delete('/admin/:id', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(CouponController.deleteCoupon)
);

export default router;

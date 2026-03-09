// src/modules/coupons/coupon.controller.js
// 优惠券控制器

import { success, paginated } from '../../common/utils/response.js';
import { CouponService } from './coupon.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class CouponController {
  
  // ==================== 用户接口 ====================
  
  /**
   * 获取可领取的优惠券列表
   */
  static getAvailableCoupons = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const coupons = await CouponService.getAvailableCoupons(userId);
    return success(res, coupons);
  });
  
  /**
   * 获取我的优惠券
   */
  static getMyCoupons = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status } = req.query;
    const coupons = await CouponService.getMyCoupons(userId, status || 'all');
    return success(res, coupons);
  });
  
  /**
   * 领取优惠券
   */
  static claimCoupon = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { couponId } = req.params;
    console.log('[CouponController] 🎫 领取优惠券:', couponId);
    const coupon = await CouponService.claimCoupon(userId, couponId);
    return success(res, coupon, '领取成功');
  });
  
  /**
   * 通过优惠券码领取
   */
  static claimByCode = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { code } = req.body;
    console.log('[CouponController] 🎫 通过码领取:', code);
    const coupon = await CouponService.claimByCode(userId, code);
    return success(res, coupon, '领取成功');
  });
  
  /**
   * 验证优惠券
   */
  static validateCoupon = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { couponId, amount, jobId } = req.body;
    console.log('[CouponController] ✅ 验证优惠券:', couponId);
    const result = await CouponService.validateCoupon(userId, couponId, amount, jobId);
    return success(res, result);
  });
  
  // ==================== 管理员接口 ====================
  
  /**
   * 获取优惠券列表（管理员）
   */
  static getAllCoupons = asyncHandler(async (req, res) => {
    const result = await CouponService.getAllCoupons(req.query);
    return paginated(res, result.coupons, result.pagination);
  });
  
  /**
   * 获取优惠券详情
   */
  static getCouponById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const coupon = await CouponService.getCouponById(id);
    return success(res, coupon);
  });
  
  /**
   * 创建优惠券
   */
  static createCoupon = asyncHandler(async (req, res) => {
    const adminId = req.user._id;
    console.log('[CouponController] 📝 创建优惠券');
    const coupon = await CouponService.createCoupon(req.body, adminId);
    return success(res, coupon, '创建成功', 201);
  });
  
  /**
   * 更新优惠券
   */
  static updateCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[CouponController] 📝 更新优惠券:', id);
    const coupon = await CouponService.updateCoupon(id, req.body);
    return success(res, coupon, '更新成功');
  });
  
  /**
   * 删除优惠券
   */
  static deleteCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[CouponController] 🗑️ 删除优惠券:', id);
    await CouponService.deleteCoupon(id);
    return success(res, null, '删除成功');
  });
  
  /**
   * 更新优惠券状态
   */
  static updateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    console.log('[CouponController] 🔄 更新状态:', id, '->', status);
    const coupon = await CouponService.updateStatus(id, status);
    return success(res, coupon, '状态更新成功');
  });
  
  /**
   * 获取优惠券统计
   */
  static getCouponStats = asyncHandler(async (req, res) => {
    const stats = await CouponService.getCouponStats();
    return success(res, stats);
  });
}

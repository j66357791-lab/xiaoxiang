// src/modules/coupons/coupon.service.js
// 优惠券服务层

import mongoose from 'mongoose';
import Coupon from './coupon.model.js';
import User from '../users/user.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/error.js';

export class CouponService {
  
  // ==================== 管理员接口 ====================
  
  /**
   * 创建优惠券
   */
  static async createCoupon(data, adminId) {
    console.log('[CouponService] 📝 创建优惠券...');
    
    // 检查优惠券码是否已存在
    if (data.code) {
      const existing = await Coupon.findOne({ code: data.code.toUpperCase() });
      if (existing) throw new ConflictError('优惠券码已存在');
    }
    
    // 验证时间
    if (new Date(data.startTime) >= new Date(data.endTime)) {
      throw new BadRequestError('开始时间必须早于结束时间');
    }
    
    const coupon = await Coupon.create({
      code: data.code?.toUpperCase() || Coupon.generateCode(),
      name: data.name,
      description: data.description,
      type: data.type,
      value: data.value,
      minAmount: data.minAmount || 0,
      maxDiscount: data.maxDiscount,
      totalCount: data.totalCount,
      perUserLimit: data.perUserLimit || 1,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      applicableCategories: data.applicableCategories || [],
      applicableJobs: data.applicableJobs || [],
      status: data.status || 'active',
      createdBy: adminId,
      sort: data.sort || 0,
    });
    
    console.log('[CouponService] ✅ 创建成功:', coupon.code);
    return coupon;
  }
  
  /**
   * 获取优惠券列表（管理员）
   */
  static async getAllCoupons(query = {}) {
    const filter = {};
    
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    
    if (query.keyword) {
      filter.$or = [
        { code: { $regex: query.keyword, $options: 'i' } },
        { name: { $regex: query.keyword, $options: 'i' } },
      ];
    }
    
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .populate('applicableCategories', 'name')
        .populate('applicableJobs', 'title')
        .populate('createdBy', 'nickname')
        .sort({ sort: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(filter),
    ]);
    
    return { coupons, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  /**
   * 获取优惠券详情
   */
  static async getCouponById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('优惠券ID无效');
    }
    
    const coupon = await Coupon.findById(id)
      .populate('applicableCategories', 'name')
      .populate('applicableJobs', 'title')
      .populate('createdBy', 'nickname');
    
    if (!coupon) throw new NotFoundError('优惠券不存在');
    return coupon;
  }
  
  /**
   * 更新优惠券
   */
  static async updateCoupon(id, data) {
    console.log('[CouponService] 📝 更新优惠券:', id);
    
    const coupon = await Coupon.findById(id);
    if (!coupon) throw new NotFoundError('优惠券不存在');
    
    // 不允许修改已使用的优惠券码
    if (data.code && data.code.toUpperCase() !== coupon.code) {
      const existing = await Coupon.findOne({ code: data.code.toUpperCase() });
      if (existing) throw new ConflictError('优惠券码已存在');
      coupon.code = data.code.toUpperCase();
    }
    
    // 更新字段
    const updatableFields = [
      'name', 'description', 'type', 'value', 'minAmount', 'maxDiscount',
      'totalCount', 'perUserLimit', 'startTime', 'endTime',
      'applicableCategories', 'applicableJobs', 'status', 'sort'
    ];
    
    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        if (field === 'startTime' || field === 'endTime') {
          coupon[field] = new Date(data[field]);
        } else {
          coupon[field] = data[field];
        }
      }
    }
    
    await coupon.save();
    console.log('[CouponService] ✅ 更新成功');
    return coupon;
  }
  
  /**
   * 删除优惠券
   */
  static async deleteCoupon(id) {
    const coupon = await Coupon.findById(id);
    if (!coupon) throw new NotFoundError('优惠券不存在');
    
    // 检查是否有用户已使用
    const usedCount = coupon.userClaims.filter(uc => uc.usedAt).length;
    if (usedCount > 0) {
      throw new BadRequestError('该优惠券已有用户使用，无法删除');
    }
    
    await Coupon.findByIdAndDelete(id);
    console.log('[CouponService] 🗑️ 删除成功:', coupon.code);
    return coupon;
  }
  
  /**
   * 更新优惠券状态
   */
  static async updateStatus(id, status) {
    const coupon = await Coupon.findById(id);
    if (!coupon) throw new NotFoundError('优惠券不存在');
    
    coupon.status = status;
    await coupon.save();
    return coupon;
  }
  
  // ==================== 用户接口 ====================
  
  /**
   * 获取用户可领取的优惠券
   */
  static async getAvailableCoupons(userId) {
    const now = new Date();
    
    const coupons = await Coupon.find({
      status: 'active',
      startTime: { $lte: now },
      endTime: { $gte: now },
      $expr: { $gt: ['$totalCount', '$claimedCount'] },
    })
    .populate('applicableCategories', 'name')
    .populate('applicableJobs', 'title')
    .sort({ sort: 1, createdAt: -1 })
    .lean();
    
    // 标记用户是否已领取
    return coupons.map(coupon => {
      const userClaim = coupon.userClaims?.find(
        uc => String(uc.userId) === String(userId)
      );
      return {
        ...coupon,
        isClaimed: !!userClaim,
        isUsed: !!userClaim?.usedAt,
      };
    });
  }
  
  /**
   * 获取用户的优惠券
   */
  static async getMyCoupons(userId, status = 'all') {
    const now = new Date();
    
    const coupons = await Coupon.find({
      'userClaims.userId': userId,
    })
    .populate('applicableCategories', 'name')
    .populate('applicableJobs', 'title')
    .sort({ createdAt: -1 })
    .lean();
    
    // 处理用户优惠券状态
    const result = coupons.map(coupon => {
      const userClaim = coupon.userClaims.find(
        uc => String(uc.userId) === String(userId)
      );
      
      let couponStatus = 'available';
      if (userClaim?.usedAt) {
        couponStatus = 'used';
      } else if (now > coupon.endTime) {
        couponStatus = 'expired';
      }
      
      return {
        ...coupon,
        couponStatus,
        claimedAt: userClaim?.claimedAt,
        usedAt: userClaim?.usedAt,
        orderId: userClaim?.orderId,
      };
    });
    
    // 按状态筛选
    if (status !== 'all') {
      return result.filter(c => c.couponStatus === status);
    }
    
    return result;
  }
  
  /**
   * 领取优惠券
   */
  static async claimCoupon(userId, couponId) {
    console.log('[CouponService] 🎫 用户领取优惠券:', userId, couponId);
    
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new NotFoundError('优惠券不存在');
    
    // 检查是否可以领取
    const { canClaim, reason } = coupon.canClaim(userId);
    if (!canClaim) {
      throw new BadRequestError(reason);
    }
    
    // 添加领取记录
    coupon.userClaims.push({
      userId,
      claimedAt: new Date(),
    });
    coupon.claimedCount += 1;
    
    await coupon.save();
    console.log('[CouponService] ✅ 领取成功');
    
    return coupon;
  }
  
  /**
   * 通过优惠券码领取
   */
  static async claimByCode(userId, code) {
    console.log('[CouponService] 🎫 通过码领取优惠券:', code);
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) throw new NotFoundError('优惠券码无效');
    
    return await this.claimCoupon(userId, coupon._id);
  }
  
  /**
   * 验证优惠券是否可用
   */
  static async validateCoupon(userId, couponId, amount = 0, jobId = null) {
    const coupon = await Coupon.findById(couponId)
      .populate('applicableCategories', 'name')
      .populate('applicableJobs', 'title');
    
    if (!coupon) {
      return { valid: false, reason: '优惠券不存在' };
    }
    
    // 检查是否可以使用
    const { canUse, reason } = coupon.canUse(userId, amount);
    if (!canUse) {
      return { valid: false, reason };
    }
    
    // 检查商品适用范围
    if (jobId) {
      const job = await mongoose.model('Job').findById(jobId);
      if (!job) {
        return { valid: false, reason: '商品不存在' };
      }
      
      // 检查是否在适用商品列表
      if (coupon.applicableJobs.length > 0) {
        const isApplicable = coupon.applicableJobs.some(
          j => String(j._id) === String(jobId)
        );
        if (!isApplicable) {
          return { valid: false, reason: '该优惠券不适用于此商品' };
        }
      }
      
      // 检查是否在适用分类
      if (coupon.applicableCategories.length > 0) {
        const jobCategories = [job.categoryL1, job.categoryL2, job.categoryL3].filter(Boolean);
        const isApplicable = coupon.applicableCategories.some(
          c => jobCategories.some(jc => String(jc._id || jc) === String(c._id))
        );
        if (!isApplicable) {
          return { valid: false, reason: '该优惠券不适用于此分类' };
        }
      }
    }
    
    // 计算优惠金额
    const discount = coupon.calculateDiscount(amount);
    
    return {
      valid: true,
      coupon,
      discount,
      finalAmount: amount - discount,
    };
  }
  
  /**
   * 使用优惠券（订单创建时调用）
   */
  static async useCoupon(userId, couponId, orderId) {
    console.log('[CouponService] 💳 使用优惠券:', couponId);
    
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new NotFoundError('优惠券不存在');
    
    // 找到用户的领取记录
    const userClaim = coupon.userClaims.find(
      uc => String(uc.userId) === String(userId) && !uc.usedAt
    );
    
    if (!userClaim) {
      throw new BadRequestError('优惠券不可用');
    }
    
    // 标记为已使用
    userClaim.usedAt = new Date();
    userClaim.orderId = orderId;
    coupon.usedCount += 1;
    
    await coupon.save();
    console.log('[CouponService] ✅ 使用成功');
    
    return coupon;
  }
  
  /**
   * 退还优惠券（订单取消时调用）
   */
  static async refundCoupon(userId, couponId, orderId) {
    console.log('[CouponService] 🔄 退还优惠券:', couponId);
    
    const coupon = await Coupon.findById(couponId);
    if (!coupon) return;
    
    // 找到使用记录
    const userClaim = coupon.userClaims.find(
      uc => String(uc.userId) === String(userId) && 
           String(uc.orderId) === String(orderId)
    );
    
    if (userClaim) {
      userClaim.usedAt = null;
      userClaim.orderId = null;
      coupon.usedCount = Math.max(0, coupon.usedCount - 1);
      await coupon.save();
      console.log('[CouponService] ✅ 退还成功');
    }
    
    return coupon;
  }
  
  /**
   * 获取优惠券统计
   */
  static async getCouponStats() {
    const stats = await Coupon.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalIssued: { $sum: '$totalCount' },
          totalClaimed: { $sum: '$claimedCount' },
          totalUsed: { $sum: '$usedCount' },
        }
      }
    ]);
    
    const totalStats = await Coupon.aggregate([
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          totalIssued: { $sum: '$totalCount' },
          totalClaimed: { $sum: '$claimedCount' },
          totalUsed: { $sum: '$usedCount' },
        }
      }
    ]);
    
    return {
      byStatus: stats,
      total: totalStats[0] || { totalCoupons: 0, totalIssued: 0, totalClaimed: 0, totalUsed: 0 }
    };
  }
}

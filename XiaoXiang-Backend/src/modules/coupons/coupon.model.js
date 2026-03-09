// src/modules/coupons/coupon.model.js
// 优惠券模型

import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema({
  // ==================== 基本信息 ====================
  code: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
  },
  description: { 
    type: String,
    trim: true,
  },
  
  // ==================== 优惠类型 ====================
  type: {
    type: String,
    enum: ['fixed', 'percent'],
    required: true,
  },
  
  // 优惠值：fixed时为固定金额，percent时为折扣比例(如10表示10%)
  value: {
    type: Number,
    required: true,
    min: 0,
  },
  
  // ==================== 使用条件 ====================
  minAmount: {
    type: Number,
    default: 0,
    comment: '最低使用金额',
  },
  maxDiscount: {
    type: Number,
    comment: '最大优惠金额（percent类型时有效）',
  },
  
  // ==================== 发放配置 ====================
  totalCount: {
    type: Number,
    required: true,
    min: 1,
    comment: '发放总量',
  },
  usedCount: {
    type: Number,
    default: 0,
    comment: '已使用数量',
  },
  claimedCount: {
    type: Number,
    default: 0,
    comment: '已领取数量',
  },
  perUserLimit: {
    type: Number,
    default: 1,
    comment: '每人限领数量',
  },
  
  // ==================== 有效期 ====================
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  
  // ==================== 适用范围 ====================
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
  applicableJobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
  }],
  
  // ==================== 用户领取记录 ====================
  userClaims: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    usedAt: {
      type: Date,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
  }],
  
  // ==================== 状态 ====================
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active',
  },
  
  // ==================== 创建者 ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // ==================== 排序 ====================
  sort: {
    type: Number,
    default: 0,
  },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ==================== 索引 ====================
CouponSchema.index({ code: 1 });
CouponSchema.index({ status: 1 });
CouponSchema.index({ startTime: 1, endTime: 1 });
CouponSchema.index({ applicableCategories: 1 });
CouponSchema.index({ applicableJobs: 1 });

// ==================== 虚拟字段 ====================
// 剩余数量
CouponSchema.virtual('remainingCount').get(function() {
  return Math.max(0, this.totalCount - this.claimedCount);
});

// 是否已过期
CouponSchema.virtual('isExpired').get(function() {
  return new Date() > this.endTime;
});

// 是否已领完
CouponSchema.virtual('isSoldOut').get(function() {
  return this.claimedCount >= this.totalCount;
});

// ==================== 静态方法 ====================
// 生成优惠券码
CouponSchema.statics.generateCode = function(prefix = 'CP') {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `${prefix}${year}${month}${random}`;
};

// 获取用户可用的优惠券
CouponSchema.statics.getAvailableForUser = async function(userId, amount = 0, jobId = null) {
  const now = new Date();
  
  const coupons = await this.find({
    status: 'active',
    startTime: { $lte: now },
    endTime: { $gte: now },
    totalCount: { $gt: '$claimedCount' },
    minAmount: { $lte: amount },
  })
  .populate('applicableCategories', 'name')
  .populate('applicableJobs', 'title')
  .sort({ sort: 1, createdAt: -1 })
  .lean();
  
  // 过滤用户已领取的优惠券
  const userCoupons = coupons.filter(coupon => {
    const userClaim = coupon.userClaims.find(uc => String(uc.userId) === String(userId));
    if (!userClaim) return true;
    // 如果已领取但未使用，也可以用
    if (!userClaim.usedAt) return true;
    return false;
  });
  
  // 如果指定了商品，过滤适用范围
  if (jobId) {
    return userCoupons.filter(coupon => {
      if (!coupon.applicableCategories.length && !coupon.applicableJobs.length) {
        return true; // 无限制
      }
      if (coupon.applicableJobs.some(j => String(j._id) === String(jobId))) {
        return true;
      }
      // TODO: 检查分类是否匹配
      return false;
    });
  }
  
  return userCoupons;
};

// ==================== 实例方法 ====================
// 计算优惠金额
CouponSchema.methods.calculateDiscount = function(originalAmount) {
  if (originalAmount < this.minAmount) {
    return 0;
  }
  
  let discount = 0;
  
  if (this.type === 'fixed') {
    discount = this.value;
  } else if (this.type === 'percent') {
    discount = originalAmount * (this.value / 100);
    if (this.maxDiscount) {
      discount = Math.min(discount, this.maxDiscount);
    }
  }
  
  // 优惠金额不能超过原价
  return Math.min(discount, originalAmount);
};

// 检查用户是否可以领取
CouponSchema.methods.canClaim = function(userId) {
  // 检查状态
  if (this.status !== 'active') {
    return { canClaim: false, reason: '优惠券已失效' };
  }
  
  // 检查时间
  const now = new Date();
  if (now < this.startTime) {
    return { canClaim: false, reason: '优惠券尚未生效' };
  }
  if (now > this.endTime) {
    return { canClaim: false, reason: '优惠券已过期' };
  }
  
  // 检查库存
  if (this.claimedCount >= this.totalCount) {
    return { canClaim: false, reason: '优惠券已领完' };
  }
  
  // 检查用户领取次数
  const userClaimCount = this.userClaims.filter(
    uc => String(uc.userId) === String(userId)
  ).length;
  
  if (userClaimCount >= this.perUserLimit) {
    return { canClaim: false, reason: '已达到领取上限' };
  }
  
  return { canClaim: true };
};

// 检查用户是否可以使用
CouponSchema.methods.canUse = function(userId, amount = 0) {
  // 检查是否已领取且未使用
  const userClaim = this.userClaims.find(
    uc => String(uc.userId) === String(userId) && !uc.usedAt
  );
  
  if (!userClaim) {
    return { canUse: false, reason: '您没有此优惠券或已使用' };
  }
  
  // 检查金额条件
  if (amount < this.minAmount) {
    return { canUse: false, reason: `订单金额需满${this.minAmount}元` };
  }
  
  // 检查时间
  const now = new Date();
  if (now < this.startTime || now > this.endTime) {
    return { canUse: false, reason: '优惠券不在有效期内' };
  }
  
  return { canUse: true };
};

export default mongoose.model('Coupon', CouponSchema);

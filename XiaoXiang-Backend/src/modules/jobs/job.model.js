// src/modules/jobs/job.model.js
// 回收商品模型（优化版）

import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  // ==================== 基本信息 ====================
  title: { type: String, required: true },
  subtitle: { type: String },
  description: { type: String },

  // ==================== 分类 ====================
  categoryL1: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryL2: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryL3: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },

  // ==================== 商品属性（动态） ====================
  attributes: [{
    name: { type: String, required: true },
    value: { type: String },
    options: [String],
    required: { type: Boolean, default: false },
  }],

  // ==================== 图片 ====================
  images: [{ type: String }],
  coverImage: { type: String },

  // ==================== 价格配置 ====================
  pricing: {
    basePrice: { type: Number, default: 0 }, // 预估价格
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    priceUnit: { type: String, default: '元' },
  },
  
  // 成色价格档位
  conditionPrices: [{
    condition: { type: String, required: true },
    description: { type: String },
    priceRate: { type: Number, default: 1 },
    price: { type: Number },
  }],

  // ==================== 🆕 预估价格（管理员发布时填写） ====================
  estimatedPrice: {
    type: Number,
    default: 0,
    comment: '预估回收价格，管理员发布时填写',
  },

  // ==================== 🆕 预估打款时间（小时） ====================
  estimatedPaymentHours: {
    type: Number,
    default: 72,
    comment: '预估打款时间，单位小时',
  },

  // ==================== 🆕 寄送方式配置 ====================
  shippingMethods: {
    express: {
      enabled: { type: Boolean, default: true },
      comment: '快递寄送',
    },
    pickup: {
      enabled: { type: Boolean, default: false },
      comment: '上门回收',
    },
    self: {
      enabled: { type: Boolean, default: false },
      comment: '自行送达',
    },
  },

  // ==================== 🆕 上门回收配置 ====================
  pickupConfig: {
    enabled: { type: Boolean, default: false },
    serviceAreas: [{
      province: String,
      city: String,
      districts: [String],
    }],
    pickupRadius: { type: Number, default: 10, comment: '服务半径（公里）' },
    availableTimes: [{
      dayOfWeek: { type: Number, min: 0, max: 6, comment: '0-6, 0表示周日' },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '18:00' },
    }],
    notice: { type: String, comment: '上门回收须知' },
  },

  // ==================== 质检仓库 ====================
  warehouse: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    name: { type: String },
    address: { type: String },
    phone: { type: String },
  },
  
  // 指定默认回收仓库
  assignedWarehouse: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Warehouse' 
  },

  // ==================== 回收配置 ====================
  recycleConfig: {
    enableRecycle: { type: Boolean, default: true },
    enableTrade: { type: Boolean, default: false },
    estimatedDays: { type: Number, default: 3 },
    freeShipping: { type: Boolean, default: true },
    supportPickup: { type: Boolean, default: false },
    pickupRadius: { type: Number, default: 10 },
  },

  // ==================== 状态 ====================
  status: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'active' },
  isFrozen: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },

  // ==================== 统计 ====================
  stats: {
    viewCount: { type: Number, default: 0 },
    recycleCount: { type: Number, default: 0 },
    favoriteCount: { type: Number, default: 0 },
  },

  // ==================== 时间 ====================
  scheduledAt: { type: Date },
  endAt: { type: Date },

  // ==================== 作者 ====================
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ==================== 排序和启用 ====================
  sort: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },

  // ==================== 兼容旧字段 ====================
  content: { type: String },
  steps: [{ text: String, image: String }],
  contentImages: [{ type: String }],
  amount: { type: Number, default: 0 },
  amountLevels: [{ level: String, amount: Number }],
  totalSlots: { type: Number, default: 999 },
  appliedCount: { type: Number, default: 0 },
  type: { type: String, default: 'single' },
  deadline: { type: Date },
  deadlineHours: { type: Number },
  depositRequirement: { type: Number, default: 0 },
  kycRequired: { type: Boolean, default: false },
  isRepeatable: { type: Boolean, default: true },
  isLimitedTime: { type: Boolean, default: false },
  autoFreeze: { type: Boolean, default: false },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// ==================== 索引 ====================
JobSchema.index({ categoryL1: 1 });
JobSchema.index({ categoryL2: 1 });
JobSchema.index({ categoryL3: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ isPublished: 1, isActive: 1 });
JobSchema.index({ sort: 1 });

// ==================== 虚拟字段 ====================
JobSchema.virtual('priceDisplay').get(function() {
  if (this.pricing?.minPrice && this.pricing?.maxPrice) {
    if (this.pricing.minPrice === this.pricing.maxPrice) return `¥${this.pricing.minPrice}`;
    return `¥${this.pricing.minPrice} - ¥${this.pricing.maxPrice}`;
  }
  return `¥${this.amount || 0}`;
});

// 🆕 预估打款时间显示
JobSchema.virtual('estimatedPaymentDisplay').get(function() {
  const hours = this.estimatedPaymentHours || 72;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}天`;
  }
  return `${hours}小时`;
});

// 🆕 可用寄送方式列表
JobSchema.virtual('availableShippingMethods').get(function() {
  const methods = [];
  if (this.shippingMethods?.express?.enabled) methods.push('express');
  if (this.shippingMethods?.pickup?.enabled) methods.push('pickup');
  if (this.shippingMethods?.self?.enabled) methods.push('self');
  return methods;
});

// ==================== 静态方法 ====================
JobSchema.statics.checkExpired = async function() {
  const now = new Date();
  const toPublish = await this.find({ scheduledAt: { $lte: now }, isPublished: false, status: 'draft' });
  for (const job of toPublish) { job.isPublished = true; job.status = 'active'; await job.save(); }
  const toEnd = await this.find({ endAt: { $lt: now }, status: 'active' });
  for (const job of toEnd) { job.status = 'ended'; await job.save(); }
  return { published: toPublish.length, ended: toEnd.length };
};

// 🆕 根据用户位置查找支持上门回收的商品
JobSchema.statics.findPickupAvailable = async function(longitude, latitude, radius = 50) {
  const jobs = await this.find({
    status: 'active',
    isPublished: true,
    isActive: true,
    'shippingMethods.pickup.enabled': true,
  })
  .populate('assignedWarehouse')
  .lean();

  // 过滤距离
  return jobs.filter(job => {
    if (!job.pickupConfig?.enabled) return false;
    // TODO: 根据仓库位置计算距离
    return true;
  });
};

export default mongoose.model('Job', JobSchema);

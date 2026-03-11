// src/modules/jobs/job.model.js
// 回收商品模型

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

  // ==================== 商品属性 ====================
  attributes: [{
    name: { type: String, required: true },
    value: String,
    options: [String],
    required: { type: Boolean, default: false },
  }],

  // ==================== 图片 ====================
  images: [{ type: String }],
  coverImage: { type: String },

  // ==================== 价格配置 ====================
  pricing: {
    basePrice: { type: Number, default: 0 },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
  },
  
  // 成色价格档位
  conditionPrices: [{
    condition: { type: String, required: true },
    priceRate: { type: Number, default: 1 },
    price: { type: Number },
  }],

  // ==================== 🆕 预估价格 ====================
  estimatedPrice: {
    type: Number,
    default: 0,
  },

  // ==================== 🆕 预计质检时间（天）====================
  estimatedInspectDays: {
    type: Number,
    default: 3,
  },

  // ==================== 🆕 预计打款时间（小时）====================
  estimatedPaymentHours: {
    type: Number,
    default: 72,
  },

  // ==================== 🆕 寄送方式配置 ====================
  shippingMethods: {
    express: {
      enabled: { type: Boolean, default: true },
    },
    pickup: {
      enabled: { type: Boolean, default: false },
    },
  },

  // ==================== 🆕 上门回收配置 ====================
  pickupConfig: {
    enabled: { type: Boolean, default: false },
    serviceCities: [String],  // 支持上门回收的城市列表
    pickupRadius: { type: Number, default: 10 },
    notice: String,
  },

  // ==================== 质检仓库 ====================
  assignedWarehouse: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Warehouse' 
  },

  // ==================== 回收配置 ====================
  recycleConfig: {
    enableRecycle: { type: Boolean, default: true },
    freeShipping: { type: Boolean, default: true },
    estimatedDays: { type: Number, default: 3 },
  },

  // ==================== 状态 ====================
  status: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'active' },
  isFrozen: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },

  // ==================== 统计 ====================
  stats: {
    viewCount: { type: Number, default: 0 },
    recycleCount: { type: Number, default: 0 },
  },

  // ==================== 时间 ====================
  scheduledAt: Date,
  endAt: Date,

  // ==================== 作者 ====================
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ==================== 排序和启用 ====================
  sort: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },

  // ==================== 兼容旧字段 ====================
  content: String,
  steps: [{ text: String, image: String }],
  contentImages: [{ type: String }],
  amount: { type: Number, default: 0 },
  amountLevels: [{ level: String, amount: Number }],
  totalSlots: { type: Number, default: 999 },
  appliedCount: { type: Number, default: 0 },
  type: { type: String, default: 'single' },
  deadline: Date,
  deadlineHours: Number,
  depositRequirement: { type: Number, default: 0 },
  kycRequired: { type: Boolean, default: false },
  isRepeatable: { type: Boolean, default: true },
  isLimitedTime: { type: Boolean, default: false },
  autoFreeze: { type: Boolean, default: false },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// ==================== 索引 ====================
JobSchema.index({ categoryL1: 1 });
JobSchema.index({ categoryL2: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ isPublished: 1, isActive: 1 });

// ==================== 虚拟字段 ====================
JobSchema.virtual('priceDisplay').get(function() {
  if (this.pricing?.minPrice && this.pricing?.maxPrice) {
    if (this.pricing.minPrice === this.pricing.maxPrice) return `¥${this.pricing.minPrice}`;
    return `¥${this.pricing.minPrice} - ¥${this.pricing.maxPrice}`;
  }
  return `¥${this.amount || 0}`;
});

JobSchema.virtual('estimatedPaymentDisplay').get(function() {
  const hours = this.estimatedPaymentHours || 72;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}天`;
  }
  return `${hours}小时`;
});

export default mongoose.model('Job', JobSchema);

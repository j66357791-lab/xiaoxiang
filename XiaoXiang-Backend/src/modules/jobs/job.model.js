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
    basePrice: { type: Number, default: 0 },
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
  
  // ==================== 质检仓库 ====================
  warehouse: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    name: { type: String },
    address: { type: String },
    phone: { type: String },
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
  status: { 
    type: String, 
    enum: ['draft', 'active', 'paused', 'ended'], 
    default: 'active' 
  },
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
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

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
    if (this.pricing.minPrice === this.pricing.maxPrice) {
      return `¥${this.pricing.minPrice}`;
    }
    return `¥${this.pricing.minPrice} - ¥${this.pricing.maxPrice}`;
  }
  return `¥${this.amount || 0}`;
});

// ==================== 静态方法 ====================
JobSchema.statics.checkExpired = async function() {
  const now = new Date();
  
  const toPublish = await this.find({
    scheduledAt: { $lte: now },
    isPublished: false,
    status: 'draft'
  });
  
  for (const job of toPublish) {
    job.isPublished = true;
    job.status = 'active';
    await job.save();
  }
  
  const toEnd = await this.find({
    endAt: { $lt: now },
    status: 'active'
  });
  
  for (const job of toEnd) {
    job.status = 'ended';
    await job.save();
  }
  
  return { published: toPublish.length, ended: toEnd.length };
};

export default mongoose.model('Job', JobSchema);

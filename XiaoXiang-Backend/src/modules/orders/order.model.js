// src/modules/orders/order.model.js
// 回收订单模型

import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  // ==================== 基本信息 ====================
  orderNumber: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  
  // ==================== 订单状态 ====================
  status: {
    type: String,
    enum: [
      'Submitted',      // 已提交
      'Shipping',       // 寄送中
      'Received',       // 已收货
      'Inspecting',     // 质检中
      'Quoted',         // 已报价
      'Accepted',       // 已接受
      'Rejected',       // 已拒绝
      'Returning',      // 退回中
      'Completed',      // 已完成
      'Cancelled',      // 已取消
    ],
    default: 'Submitted'
  },
  
  // ==================== 商品快照 ====================
  jobSnapshot: {
    title: String,
    subtitle: String,
    images: [String],
    coverImage: String,
    categories: {
      l1: { id: String, name: String, color: String },
      l2: { id: String, name: String, color: String },
      l3: { id: String, name: String, color: String },
    },
    pricing: {
      basePrice: Number,
      minPrice: Number,
      maxPrice: Number,
    },
  },
  
  // ==================== 用户填写的商品信息 ====================
  productInfo: {
    condition: { 
      type: String, 
      enum: ['全新', '99新', '95新', '9成新', '8成新', '7成新以下'],
    },
    conditionNote: { type: String },
    defects: [String],
    accessories: [String],
    purchaseDate: { type: Date },
    purchaseChannel: { type: String },
    images: [String],
    description: { type: String },
  },
  
  // ==================== 价格信息 ====================
  pricing: {
    estimatedPrice: { type: Number },
    quotedPrice: { type: Number },
    finalPrice: { type: Number },
    priceFactors: [{
      factor: { type: String },
      impact: { type: Number },
      description: { type: String },
    }],
  },
  
  // ==================== 物流信息 ====================
  shipping: {
    method: { 
      type: String, 
      enum: ['express', 'pickup', 'self'],
      default: 'express',
    },
    expressCompany: { type: String },
    trackingNumber: { type: String },
    shippedAt: { type: Date },
    receivedAt: { type: Date },
    receivedBy: { type: String },
    returnExpressCompany: { type: String },
    returnTrackingNumber: { type: String },
    returnedAt: { type: Date },
    userAddress: {
      province: String,
      city: String,
      district: String,
      address: String,
      phone: String,
      contactName: String,
    },
  },
  
  // ==================== 质检信息 ====================
  inspection: {
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inspectedAt: { type: Date },
    status: { 
      type: String, 
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },
    report: { type: String },
    images: [String],
    videos: [String],
    notes: { type: String },
  },
  
  // ==================== 打款信息 ====================
  payment: {
    method: { 
      type: String, 
      enum: ['alipay', 'wechat', 'bank'],
    },
    account: { type: String },
    accountName: { type: String },
    bankName: { type: String },
    paidAt: { type: Date },
    proof: { type: String },
    transactionId: { type: String },
  },
  
  // ==================== 仓库信息 ====================
  warehouse: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    name: String,
    address: String,
    phone: String,
  },
  
  // ==================== 时间记录 ====================
  timeline: {
    submittedAt: { type: Date, default: Date.now },
    shippedAt: { type: Date },
    receivedAt: { type: Date },
    inspectingAt: { type: Date },
    quotedAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  
  // ==================== 取消/拒绝原因 ====================
  cancelReason: { type: String },
  rejectReason: { type: String },
  
  // ==================== 备注 ====================
  notes: { type: String },
  adminNotes: { type: String },
  
  // ==================== 兼容旧字段 ====================
  description: { type: String },
  evidence: [{ type: String }],
  amount: { type: Number },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentProof: { type: String },
  paymentNote: { type: String },
  
}, { 
  timestamps: true 
});

// ==================== 索引 ====================
OrderSchema.index({ userId: 1 });
OrderSchema.index({ jobId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ createdAt: -1 });

// ==================== Pre-save 钩子 ====================
OrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    switch(this.status) {
      case 'Shipping': this.timeline.shippedAt = now; break;
      case 'Received': this.timeline.receivedAt = now; break;
      case 'Inspecting': this.timeline.inspectingAt = now; break;
      case 'Quoted': this.timeline.quotedAt = now; break;
      case 'Accepted': this.timeline.acceptedAt = now; break;
      case 'Rejected': this.timeline.rejectedAt = now; break;
      case 'Completed': this.timeline.completedAt = now; break;
      case 'Cancelled': this.timeline.cancelledAt = now; break;
    }
  }
  next();
});

// ==================== 静态方法 ====================
OrderSchema.statics.generateOrderNumber = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RC${year}${month}${day}${random}`;
};

export default mongoose.model('Order', OrderSchema);

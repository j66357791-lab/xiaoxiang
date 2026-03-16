// src/modules/orders/order.model.js
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
      'Rejected',       // 已拒绝（待处理回寄）
      'Returning',      // 回寄中
      'ReturnConfirmed',// 回寄已确认（用户确认收货）
      'Completed',      // 已完成
      'Cancelled',      // 已取消
    ],
    default: 'Submitted'
  },
  
  // 订单类型：recycle-回收订单，return-回寄订单
  orderType: {
    type: String,
    enum: ['recycle', 'return'],
    default: 'recycle',
  },
  
  // ==================== 商品快照 ====================
  jobSnapshot: {
    title: String,
    subtitle: String,
    images: [String],
    coverImage: String,
    categories: {
      l1: { id: String, name: String },
      l2: { id: String, name: String },
      l3: { id: String, name: String },
    },
    estimatedPrice: Number,
    estimatedPaymentHours: Number,
    estimatedInspectDays: Number,
  },
  
  // ==================== 用户填写的商品信息 ====================
  productInfo: {
    condition: { 
      type: String, 
      enum: ['全新', '99新', '95新', '9成新', '8成新', '7成新以下'],
    },
    conditionNote: String,
    description: String,
    images: [String],
  },
  
  // ==================== 价格信息 ====================
  pricing: {
    basePrice: Number,
    conditionRate: Number,
    estimatedPrice: Number,
    quotedPrice: Number,
    couponDiscount: Number,
    finalPrice: Number,
  },
  
  // ==================== 优惠券信息 ====================
  coupon: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    code: String,
    name: String,
    type: String,
    value: Number,
    discountAmount: Number,
  },
  
  // ==================== 物流信息（用户寄出） ====================
  shipping: {
    method: { 
      type: String, 
      enum: ['express', 'pickup'],
      default: 'express',
    },
    expressCompany: String,
    trackingNumber: String,
    shippedAt: Date,
    receivedAt: Date,
  },
  
  // ==================== 回寄物流信息 ====================
  returnShipping: {
    expressCompany: String,
    trackingNumber: String,
    shippedAt: Date,
    receivedAt: Date,
    confirmedAt: Date,      // 用户确认收货时间
    notes: String,          // 回寄备注
  },
  
  // ==================== 仓库信息 ====================
  warehouse: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    name: String,
    address: {
      province: String,
      city: String,
      district: String,
      detail: String,
    },
    phone: String,
  },
  
  // ==================== 上门回收信息 ====================
  pickupInfo: {
    city: String,
    district: String,
    detailAddress: String,
    contactName: String,
    contactPhone: String,
    scheduledTime: Date,
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  
  // ==================== 收款信息 ====================
  payment: {
    method: { 
      type: String, 
      enum: ['alipay', 'wechat', 'bank'],
    },
    account: String,
    accountName: String,
    bankName: String,
    paidAt: Date,
    transactionId: String,
  },
  
  // ==================== 质检信息 ====================
  inspection: {
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inspectedAt: Date,
    status: { 
      type: String, 
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },
    report: String,
    images: [String],
    notes: String,
  },
  
  // ==================== 时间记录 ====================
  timeline: {
    submittedAt: { type: Date, default: Date.now },
    shippedAt: Date,
    receivedAt: Date,
    inspectingAt: Date,
    quotedAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
    returningAt: Date,        // 回寄发出时间
    returnConfirmedAt: Date,  // 回寄确认时间
    completedAt: Date,
    cancelledAt: Date,
  },
  
  // ==================== 取消/拒绝原因 ====================
  cancelReason: String,
  rejectReason: String,
  notes: String,
  
  // ==================== 兼容旧字段 ====================
  description: String,
  evidence: [String],
  amount: Number,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { 
  timestamps: true 
});

// ==================== 索引 ====================
OrderSchema.index({ userId: 1 });
OrderSchema.index({ jobId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ orderType: 1 });
OrderSchema.index({ createdAt: -1 });

// ==================== 静态方法：生成订单号 ====================
OrderSchema.statics.generateOrderNumber = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RC${year}${month}${day}${random}`;
};

// ==================== 实例方法：计算最终价格 ====================
OrderSchema.methods.calculateFinalPrice = function() {
  let finalPrice = this.pricing.estimatedPrice || 0;
  if (this.coupon?.discountAmount) {
    finalPrice = Math.max(0, finalPrice - this.coupon.discountAmount);
  }
  return finalPrice;
};

export default mongoose.model('Order', OrderSchema);

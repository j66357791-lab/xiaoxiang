import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
  // === 基础信息 (来自订单) ===
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // 资产名称 (订单标题)
  costPrice: { type: Number, default: 0 }, // 成本价

  // === 状态管理 ===
  status: { type: String, enum: ['InStock', 'Disposed'], default: 'InStock' },
  source: { type: String, enum: ['Manual', 'Auto'], default: 'Manual' },

  // === 🚀 前端组件所需的处置字段 (新增) ===
  
  // 处置详情
  resalePlatform: { type: String },      // 转售平台
  resaleOrderNo: { type: String },       // 外部订单号
  soldPrice: { type: Number },           // 变现金额
  disposeAction: { type: String },       // 处置动作 (确定售卖/确定结算/确定完结)
  disposedAt: { type: Date },            // 处置时间
  isShelved: { type: Boolean, default: false }, // 是否搁置
  
  // 物流信息
  shippingNeeded: { type: Boolean, default: false },
  trackingNo: { type: String },          // 快递单号
  shippingCost: { type: Number, default: 0 }, // 快递成本

  // 其他成本
  otherCostAmount: { type: Number, default: 0 },
  otherCostRemark: { type: String },

}, {
  timestamps: true // 自动生成 createdAt (用于计算压货天数)
});

const Asset = mongoose.model('Asset', assetSchema);
export default Asset;

// src/modules/asset/asset.model.js
import mongoose from 'mongoose';

const AssetSchema = new mongoose.Schema({
  // 关联信息
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true }, 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  
  // 基础信息 (对应前端 productName, userName, costPrice)
  productName: { type: String, required: true }, // 对应 order.jobSnapshot.title
  userName: { type: String }, // 冗余存储用户邮箱/名称，方便列表显示
  costPrice: { type: Number, default: 0 }, // 对应 order.jobSnapshot.amount
  
  // 状态
  status: {
    type: String,
    enum: ['Stocked', 'Disposed'], // 对应前端 ASSET_STATUS
    default: 'Stocked'
  },
  
  // 库存管理
  stockDays: { type: Number, default: 0 }, // 入库天数
  isShelved: { type: Boolean, default: false }, // 是否搁置

  // ==================== 处置详情 (完全对齐前端字段) ====================
  soldPrice: { type: Number, default: null },          // 售卖金额
  resalePlatform: { type: String },                    // 转售平台 (对应前端 resalePlatform)
  resaleOrderNo: { type: String },                     // 外部订单号 (对应前端 resaleOrderNo)
  
  shippingNeeded: { type: Boolean, default: false },   // 是否需要快递
  shippingCost: { type: Number, default: 0 },          // 快递成本
  trackingNo: { type: String },                        // 物流单号
  
  otherCostAmount: { type: Number, default: 0 },       // 其他成本金额
  otherCostRemark: { type: String },                   // 其他成本备注
  
  disposeAction: { type: String }, // 当前处置动作 (确定售卖/确定结算/确定完结)
  remark: { type: String },        // 备注
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  disposedAt: { type: Date } // 处置时间
});

// 更新库存天数 (可以在查询时计算或定时任务更新)
AssetSchema.methods.updateStockDays = function() {
  this.stockDays = Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
};

export default mongoose.model('Asset', AssetSchema);

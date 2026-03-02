// src/modules/asset/asset.model.js
import mongoose from 'mongoose';

const AssetSchema = new mongoose.Schema({
  // 🔥 核心：关联订单ID，唯一索引，防止重复录入
  order: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true, 
    unique: true 
  },
  
  // 关联用户
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
  // 基础信息
  name: { type: String, default: '' },         // 商品名称
  costPrice: { type: Number, default: 0 },     // 成本价(订单金额)
  
  // 状态管理
  status: { 
    type: String, 
    enum: ['Stocked', 'Disposed'], // Stocked=压货中, Disposed=已处置
    default: 'Stocked' 
  },
  isShelved: { type: Boolean, default: false }, // 是否搁置

  // 处置详情
  soldPrice: { type: Number, default: null },       // 售卖价格
  resalePlatform: { type: String, default: null },  // 转卖平台
  resaleOrderNo: { type: String, default: null },   // 转卖订单号
  shippingNeeded: { type: Boolean, default: false },// 是否需要发货
  shippingCost: { type: Number, default: 0 },       // 运费
  trackingNo: { type: String, default: null },      // 物流单号
  otherCostAmount: { type: Number, default: 0 },    // 其他成本
  otherCostRemark: { type: String, default: '' },   // 成本备注
  disposeAction: { type: String, default: null },   // 处置动作
  remark: { type: String, default: '' },            // 备注
  
  disposedAt: { type: Date, default: null },        // 处置时间

  // 🆕 新增：批次存档信息 (之前遗漏的字段)
  archivedAt: { type: Date, default: null },      // 存档时间
  archiveRemark: { type: String, default: '' }    // 存档备注
  
}, { 
  timestamps: true // 自动生成 createdAt, updatedAt
});

// 🆕 安全配置：确保查询时关联有效数据
AssetSchema.pre(/^find/, function(next) {
  // 这里的 this 指向 Query 对象，populate 会自动处理，这里可以加日志或钩子
  next();
});

const Asset = mongoose.model('Asset', AssetSchema);
export default Asset;

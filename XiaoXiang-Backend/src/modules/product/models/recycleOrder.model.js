import mongoose from 'mongoose';

const RecycleOrderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    unique: true, 
    required: true 
  },
  
  // 关联任务和商品
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RecycleTask' 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  },
  productName: { type: String },
  
  // 用户信息
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  userName: { type: String },
  
  // 数量
  quantity: { type: Number, default: 1 },
  
  // 价格信息
  purchasePrice: { type: Number },      // 扫货价
  salePrice: { type: Number },          // 卖出价
  recyclePrice: { type: Number },       // 回收价
  userProfit: { type: Number },         // 用户利润
  
  // 状态
  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'received', 'bound', 'approved', 'rejected', 'settled', 'cancelled'],
    default: 'pending'
  },
  
  // 绑定售卖信息
  bindInfo: {
    platform: { type: String },         // 售卖平台
    orderNo: { type: String },          // 售卖订单号
    salePrice: { type: Number },        // 实际售价
    bindAt: { type: Date },             // 绑定时间
    bindBy: {                           // 绑定人
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // 管理员备注
  adminRemark: { type: String },
  
  // 结算截止日期
  settleDeadline: { type: Date },
  
  // 结算时间
  settledAt: { type: Date },
  
}, { timestamps: true });

// 索引
RecycleOrderSchema.index({ status: 1 });
RecycleOrderSchema.index({ orderNumber: 1 });

export default mongoose.model('RecycleOrder', RecycleOrderSchema);

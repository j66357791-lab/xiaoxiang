import mongoose from 'mongoose';

// 订单绑定模型
const OrderBindSchema = new mongoose.Schema({
  // 关联订单
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true,
    unique: true  // 一个订单只能绑定一次
  },
  orderNumber: { type: String, required: true },
  
  // 关联商品和SKU
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  productName: { type: String, required: true },
  skuId: { type: mongoose.Schema.Types.ObjectId, required: true },
  skuName: { type: String, required: true },
  
  // 价格信息
  purchasePrice: { type: Number, required: true },      // 进货价
  salePrice: { type: Number, required: true },          // 预期售价
  actualSalePrice: { type: Number },                     // 实际售价
  settleAmount: { type: Number, required: true },        // 用户结算金额
  
  // 利润计算
  productProfit: { type: Number },                       // 商品利润 = 实际售价 - 进货价
  platformIncome: { type: Number },                      // 平台收入 = 实际售价 - 结算金额
  userProfit: { type: Number },                          // 用户收益 = 结算金额 - 进货价
  
  // 站外信息（选填）
  externalPlatform: { 
    type: String, 
    enum: ['', '闲鱼', '淘宝', '京东', '拼多多', '其他'],
    default: '' 
  },
  externalOrderNo: { type: String },
  externalOrderUrl: { type: String },
  remark: { type: String },
  
  // 绑定状态
  status: {
    type: String,
    enum: ['bound', 'completed', 'cancelled'],
    default: 'bound'
  },
  
  // 是否完结订单
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  
  // 操作人
  bindBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
}, { timestamps: true });

// 索引
OrderBindSchema.index({ orderId: 1 });
OrderBindSchema.index({ productId: 1, skuId: 1 });
OrderBindSchema.index({ status: 1 });
OrderBindSchema.index({ createdAt: -1 });

// 保存前计算利润
OrderBindSchema.pre('save', function(next) {
  const actualSale = this.actualSalePrice || this.salePrice;
  
  this.productProfit = actualSale - this.purchasePrice;
  this.platformIncome = actualSale - this.settleAmount;
  this.userProfit = this.settleAmount - this.purchasePrice;
  
  next();
});

// 静态方法：获取绑定统计
OrderBindSchema.statics.getBindStats = async function(startDate, endDate) {
  const match = {};
  
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalBinds: { $sum: 1 },
        totalSalePrice: { $sum: { $ifNull: ['$actualSalePrice', '$salePrice'] } },
        totalPurchasePrice: { $sum: '$purchasePrice' },
        totalSettleAmount: { $sum: '$settleAmount' },
        totalProductProfit: { $sum: '$productProfit' },
        totalPlatformIncome: { $sum: '$platformIncome' },
        totalUserProfit: { $sum: '$userProfit' }
      }
    }
  ]);
  
  return stats[0] || {
    totalBinds: 0,
    totalSalePrice: 0,
    totalPurchasePrice: 0,
    totalSettleAmount: 0,
    totalProductProfit: 0,
    totalPlatformIncome: 0,
    totalUserProfit: 0
  };
};

// 静态方法：获取待绑定订单
OrderBindSchema.statics.getPendingOrders = async function() {
  // 获取已绑定的订单ID
  const boundOrders = await this.distinct('orderId');
  
  // 获取可绑定的订单（已接单、已提交、审核中状态）
  const Order = mongoose.model('Order');
  const pendingOrders = await Order.find({
    _id: { $nin: boundOrders },
    status: { $in: ['Applied', 'Submitted', 'Reviewing'] }
  })
    .populate('userId', 'name phone')
    .populate('jobId', 'title amount')
    .sort({ createdAt: -1 });
  
  return pendingOrders;
};

export default mongoose.model('OrderBind', OrderBindSchema);

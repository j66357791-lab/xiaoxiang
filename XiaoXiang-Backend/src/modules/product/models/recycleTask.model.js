import mongoose from 'mongoose';

const RecycleTaskSchema = new mongoose.Schema({
  taskNumber: { 
    type: String, 
    unique: true, 
    required: true 
  },
  
  // 关联商品
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  productName: { type: String, required: true },
  
  // 价格信息
  purchasePrice: { type: Number, required: true },  // 扫货价
  salePrice: { type: Number, required: true },      // 卖出价
  recyclePrice: { type: Number, required: true },   // 回收价（给用户的钱）
  userProfit: { type: Number, required: true },     // 用户利润
  
  // 数量
  quantity: { type: Number, default: 1 },
  settledQuantity: { type: Number, default: 0 },
  
  // 结算天数
  settleDays: { type: Number, default: 7 },
  
  // 状态
  status: { 
    type: String, 
    enum: ['open', 'closed'], 
    default: 'open' 
  },
  
  // 创建人
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
}, { timestamps: true });

export default mongoose.model('RecycleTask', RecycleTaskSchema);

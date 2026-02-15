import mongoose from 'mongoose';

const RecycleOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true }, // RC2024...
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecycleTask', required: true }, // 关联任务
  
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 接单用户
  userName: { type: String },
  
  quantity: { type: Number, default: 1 },
  recyclePrice: { type: Number, required: true }, 
  userProfit: { type: Number, required: true }, 
  
  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'received', 'bound', 'approved', 'settled', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // 售卖绑定信息
  saleBindInfo: {
    platformName: { type: String }, 
    platformOrderNo: { type: String }, 
    salePrice: { type: Number }, 
    bindAt: { type: Date },
    bindBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  
  settleDeadline: { type: Date },
  settledAt: { type: Date },
  
  paidAt: { type: Date },
  shippedAt: { type: Date },
  receivedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('RecycleOrder', RecycleOrderSchema);

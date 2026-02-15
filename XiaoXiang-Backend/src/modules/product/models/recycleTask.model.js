import mongoose from 'mongoose';

// 管理员发布的回收需求
const RecycleTaskSchema = new mongoose.Schema({
  taskNumber: { type: String, unique: true, required: true }, // TASK2024...
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  
  recyclePrice: { type: Number, required: true }, // 回收价
  quantity: { type: Number, default: 1 }, // 需求数量
  settledQuantity: { type: Number, default: 0 }, // 已被接单数量
  
  settleDays: { type: Number, default: 7 }, // 承诺结算天数
  
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('RecycleTask', RecycleTaskSchema);

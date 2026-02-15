import mongoose from 'mongoose';

const RecycleTaskSchema = new mongoose.Schema({
  taskNumber: { type: String, unique: true, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  
  // 价格快照 (随商品更新而同步)
  purchasePrice: { type: Number, required: true }, 
  salePrice: { type: Number, required: true },     
  recyclePrice: { type: Number, required: true }, // 给用户的回收价
  
  quantity: { type: Number, default: 1 },
  settledQuantity: { type: Number, default: 0 },
  settleDays: { type: Number, default: 7 },
  
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('RecycleTask', RecycleTaskSchema);

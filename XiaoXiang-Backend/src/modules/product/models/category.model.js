import mongoose from 'mongoose';

const ProductCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  sort: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// 使用不同的模型名避免冲突
export default mongoose.model('ProductCategory', ProductCategorySchema);

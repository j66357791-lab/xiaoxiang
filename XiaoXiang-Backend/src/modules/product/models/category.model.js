import mongoose from 'mongoose';

// 使用 ProductCategory 名称避免与主分类模块的 Category 冲突
const ProductCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  sort: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('ProductCategory', ProductCategorySchema);

import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryId: { type: String, required: true },
  categoryName: { type: String },
  description: { type: String, trim: true },
  
  // 价格
  costPrice: { type: Number, default: 0 }, 
  sellPrice: { type: Number, default: 0 }, 
  shippingCost: { type: Number, default: 0 }, 
  
  // 库存
  stock: { type: Number, default: 0 },
  frozenStock: { type: Number, default: 0 },
  
  supportedPlatforms: [{ type: String }], 
  
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ProductSchema.index({ name: 'text' });

export default mongoose.model('Product', ProductSchema);

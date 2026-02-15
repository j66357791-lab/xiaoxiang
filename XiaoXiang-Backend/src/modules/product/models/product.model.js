import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // ref 改为 ProductCategory 避免与主分类冲突
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', required: true },
  createdAt: { type: Date, default: Date.now },
  
  // 价格体系
  purchasePrice: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  profitRate: { type: Number, default: 0 },
  
  // 平台信息
  minPurchasePlatform: { type: String }, 
  maxSalePlatform: { type: String },     
  
  // 库存
  stock: { type: Number, default: 0 },
  
  // 监控配置
  isMonitored: { type: Boolean, default: false },
  monitorInterval: { type: Number, default: 24 },
  lastPriceUpdateAt: { type: Date, default: Date.now },
  
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ProductSchema.index({ name: 'text' });
export default mongoose.model('Product', ProductSchema);

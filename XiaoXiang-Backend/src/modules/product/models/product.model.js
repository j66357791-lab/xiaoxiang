import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', required: true },
  createdAt: { type: Date, default: Date.now }, // 支持管理员配置日期
  
  // 价格体系
  purchasePrice: { type: Number, default: 0 }, // 扫货价
  salePrice: { type: Number, default: 0 },     // 售卖价
  profit: { type: Number, default: 0 },        // 自动计算
  profitRate: { type: Number, default: 0 },    // 自动计算
  
  // 平台信息 (监控更新内容)
  minPurchasePlatform: { type: String }, 
  maxSalePlatform: { type: String },     
  
  // 库存
  stock: { type: Number, default: 0 },
  
  // 监控配置
  isMonitored: { type: Boolean, default: false },
  monitorInterval: { type: Number, default: 24 }, // 12, 24, 48
  lastPriceUpdateAt: { type: Date, default: Date.now },
  
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ProductSchema.index({ name: 'text' });
export default mongoose.model('Product', ProductSchema);

import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  categoryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true 
  },
  
  // 价格体系
  purchasePrice: { type: Number, default: 0 },  // 扫货价
  salePrice: { type: Number, default: 0 },      // 卖出价
  profit: { type: Number, default: 0 },         // 利润（自动计算）
  profitRate: { type: Number, default: 0 },     // 利润率（自动计算）
  
  // 库存
  stock: { type: Number, default: 0 },
  
  // 状态
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  },
  
  // 创建人
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
}, { timestamps: true });

// 索引
ProductSchema.index({ name: 'text' });
ProductSchema.index({ categoryId: 1 });

export default mongoose.model('Product', ProductSchema);

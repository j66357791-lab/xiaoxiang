import mongoose from 'mongoose';

// SKU规格子模型
const SkuSchema = new mongoose.Schema({
  name: { type: String, required: true },           // 规格名称，如"iPhone 13 黑色"
  purchasePrice: { type: Number, default: 0 },      // 进货价
  salePrice: { type: Number, default: 0 },          // 售价
  currentStock: { type: Number, default: 0 },       // 当前库存
  minStock: { type: Number, default: 10 },          // 库存预警线
  maxStock: { type: Number, default: 100 },         // 库存上限
  specs: {                                          // 规格属性
    model: String,                                  // 型号
    color: String,                                  // 颜色
    size: String,                                   // 尺寸
    custom: mongoose.Schema.Types.Mixed             // 自定义属性
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'soldout'],
    default: 'active'
  },
  order: { type: Number, default: 0 }               // 排序
}, { _id: true, timestamps: false });

// 商品模型（扩展版）
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
  
  // SKU规格列表
  skus: [SkuSchema],
  
  // 默认价格（用于显示）
  defaultPurchasePrice: { type: Number, default: 0 },
  defaultSalePrice: { type: Number, default: 0 },
  
  // 统计字段（自动计算）
  totalStock: { type: Number, default: 0 },          // 总库存
  totalValue: { type: Number, default: 0 },          // 总价值
  warningCount: { type: Number, default: 0 },        // 预警数量
  
  // 描述
  description: { type: String },
  images: [{ type: String }],
  
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
ProductSchema.index({ status: 1 });

// 保存前计算统计
ProductSchema.pre('save', function(next) {
  // 计算总库存和总价值
  let totalStock = 0;
  let totalValue = 0;
  let warningCount = 0;
  
  if (this.skus && this.skus.length > 0) {
    this.skus.forEach(sku => {
      totalStock += sku.currentStock || 0;
      totalValue += (sku.currentStock || 0) * (sku.purchasePrice || 0);
      
      // 检查库存预警
      if ((sku.currentStock || 0) <= (sku.minStock || 0)) {
        warningCount++;
      }
    });
    
    // 设置默认价格（取第一个SKU）
    this.defaultPurchasePrice = this.skus[0]?.purchasePrice || 0;
    this.defaultSalePrice = this.skus[0]?.salePrice || 0;
  }
  
  this.totalStock = totalStock;
  this.totalValue = totalValue;
  this.warningCount = warningCount;
  
  next();
});

// 实例方法：获取SKU
ProductSchema.methods.getSku = function(skuId) {
  return this.skus.id(skuId);
};

// 实例方法：调整SKU库存
ProductSchema.methods.adjustSkuStock = function(skuId, quantity, reason = '') {
  const sku = this.skus.id(skuId);
  if (!sku) throw new Error('SKU不存在');
  
  const beforeStock = sku.currentStock;
  sku.currentStock += quantity;
  
  // 更新状态
  if (sku.currentStock <= 0) {
    sku.status = 'soldout';
  } else if (sku.currentStock <= sku.minStock) {
    sku.status = 'active'; // 库存不足但仍可售
  }
  
  return {
    sku,
    beforeStock,
    afterStock: sku.currentStock,
    diff: quantity
  };
};

// 静态方法：获取库存预警商品
ProductSchema.statics.getWarningProducts = async function() {
  const products = await this.find({ status: 'active' })
    .populate('categoryId', 'name');
  
  const warnings = [];
  
  products.forEach(product => {
    if (product.skus) {
      product.skus.forEach(sku => {
        if ((sku.currentStock || 0) <= (sku.minStock || 0)) {
          warnings.push({
            productId: product._id,
            productName: product.name,
            categoryId: product.categoryId,
            skuId: sku._id,
            skuName: sku.name,
            currentStock: sku.currentStock,
            minStock: sku.minStock,
            severity: sku.currentStock <= 0 ? 'danger' : 'warning'
          });
        }
      });
    }
  });
  
  return warnings;
};

// 静态方法：获取库存统计
ProductSchema.statics.getStockStats = async function(categoryId = null) {
  const match = { status: 'active' };
  if (categoryId) {
    match.categoryId = new mongoose.Types.ObjectId(categoryId);
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalSkus: { $sum: { $size: '$skus' } },
        totalStock: { $sum: '$totalStock' },
        totalValue: { $sum: '$totalValue' },
        warningCount: { $sum: '$warningCount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalProducts: 0,
    totalSkus: 0,
    totalStock: 0,
    totalValue: 0,
    warningCount: 0
  };
};

export default mongoose.model('Product', ProductSchema);

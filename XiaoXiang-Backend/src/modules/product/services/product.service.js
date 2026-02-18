import Product from '../models/product.model.js';
import StockLog from '../models/stockLog.model.js';
import mongoose from 'mongoose';

// 计算利润
const calculateProfit = (purchasePrice, salePrice) => {
  const profit = (salePrice || 0) - (purchasePrice || 0);
  const profitRate = purchasePrice > 0 
    ? parseFloat(((profit / purchasePrice) * 100).toFixed(2)) 
    : 0;
  return { profit, profitRate };
};

// 记录库存变更
const logStockChange = async (product, diff, reason, user) => {
  await StockLog.create({
    module: 'stock',
    action: 'adjust',
    targetId: product._id,
    targetName: product.name,
    changes: { 
      before: product.totalStock - diff, 
      after: product.totalStock, 
      diff 
    },
    reason,
    operator: { 
      id: user._id, 
      name: user.name, 
      role: user.role 
    }
  });
};

// 获取回收中心分类ID
const getRecycleCategoryId = async () => {
  const Category = mongoose.model('Category');
  const recycleCategory = await Category.findOne({ 
    name: { $regex: '回收', $options: 'i' } 
  });
  return recycleCategory?._id;
};

// ==================== 商品服务 ====================

// 创建商品
export const createProduct = async (data, user) => {
  const product = new Product({
    ...data,
    createdBy: user._id
  });
  
  await product.save();
  return product;
};

// 更新商品
export const updateProduct = async (id, data, user) => {
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const allowedFields = ['name', 'categoryId', 'description', 'images', 'status'];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      product[field] = data[field];
    }
  }
  
  await product.save();
  return product;
};

// 获取商品列表
export const getProducts = async (query) => {
  const { category, status, search, recycleOnly, hasWarning } = query;
  let filter = {};
  
  if (recycleOnly !== 'false') {
    const recycleCategoryId = await getRecycleCategoryId();
    if (recycleCategoryId) {
      filter.categoryId = recycleCategoryId;
    }
  }
  
  if (category && category !== 'all') {
    filter.categoryId = new mongoose.Types.ObjectId(category);
  }
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }
  if (hasWarning === 'true') {
    filter.warningCount = { $gt: 0 };
  }
  
  const products = await Product.find(filter)
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 });
  
  return products;
};

// 获取单个商品
export const getProductById = async (id) => {
  const product = await Product.findById(id).populate('categoryId', 'name');
  if (!product) throw new Error('商品不存在');
  return product;
};

// 删除商品
export const deleteProduct = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new Error('商品不存在');
  return product;
};

// ==================== SKU服务 ====================

// 添加SKU
export const addSku = async (productId, skuData, user) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');
  
  product.skus.push(skuData);
  await product.save();
  
  return product;
};

// 更新SKU
export const updateSku = async (productId, skuId, skuData, user) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');
  
  const sku = product.skus.id(skuId);
  if (!sku) throw new Error('规格不存在');
  
  const allowedFields = ['name', 'purchasePrice', 'salePrice', 'currentStock', 'minStock', 'maxStock', 'specs', 'status', 'order'];
  
  for (const field of allowedFields) {
    if (skuData[field] !== undefined) {
      sku[field] = skuData[field];
    }
  }
  
  await product.save();
  return product;
};

// 删除SKU
export const deleteSku = async (productId, skuId, user) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');
  
  const sku = product.skus.id(skuId);
  if (!sku) throw new Error('规格不存在');
  
  // 检查是否有绑定记录
  const OrderBind = mongoose.model('OrderBind');
  const bindCount = await OrderBind.countDocuments({ productId, skuId });
  if (bindCount > 0) {
    throw new Error('该规格已有绑定记录，无法删除');
  }
  
  sku.deleteOne();
  await product.save();
  
  return product;
};

// ==================== 统计服务 ====================

// 获取统计数据
export const getStats = async () => {
  const recycleCategoryId = await getRecycleCategoryId();
  let filter = {};
  
  if (recycleCategoryId) {
    filter.categoryId = recycleCategoryId;
  }
  
  const stats = await Product.aggregate([
    { $match: filter },
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

export default {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  deleteProduct,
  addSku,
  updateSku,
  deleteSku,
  getStats
};

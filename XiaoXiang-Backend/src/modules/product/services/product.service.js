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
      before: product.stock - diff, 
      after: product.stock, 
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
  const { purchasePrice, salePrice } = data;
  const { profit, profitRate } = calculateProfit(purchasePrice, salePrice);
  
  const product = new Product({
    ...data,
    profit,
    profitRate,
    createdBy: user._id
  });
  
  await product.save();
  return product;
};

// 更新商品
export const updateProduct = async (id, data, user) => {
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const allowedFields = ['name', 'categoryId', 'purchasePrice', 'salePrice', 'stock', 'status'];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      product[field] = data[field];
    }
  }
  
  if (data.purchasePrice !== undefined || data.salePrice !== undefined) {
    const { profit, profitRate } = calculateProfit(
      data.purchasePrice ?? product.purchasePrice,
      data.salePrice ?? product.salePrice
    );
    product.profit = profit;
    product.profitRate = profitRate;
  }
  
  await product.save();
  return product;
};

// 获取商品列表
export const getProducts = async (query) => {
  const { category, status, search, recycleOnly } = query;
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

// 调整库存
export const adjustStock = async (id, newStock, reason, user) => {
  if (!reason) throw new Error('调整原因不能为空');
  
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const diff = newStock - product.stock;
  product.stock = newStock;
  await product.save();
  
  await logStockChange(product, diff, reason, user);
  
  return product;
};

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
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
        totalProfit: { $sum: '$profit' },
        lowStockCount: { 
          $sum: { 
            $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] 
          } 
        },
        emptyStockCount: { 
          $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } 
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    totalProfit: 0,
    lowStockCount: 0,
    emptyStockCount: 0
  };
};

// 删除商品
export const deleteProduct = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new Error('商品不存在');
  return product;
};

export default {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  adjustStock,
  getStats,
  deleteProduct
};

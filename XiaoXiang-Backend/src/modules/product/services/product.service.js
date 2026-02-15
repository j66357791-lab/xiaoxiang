import Product from '../models/product.model.js';
import RecycleTask from '../models/recycleTask.model.js';
import StockLog from '../models/stockLog.model.js';
import mongoose from 'mongoose';
import { notifyAdmins } from './notification.service.js';

const calculateProfit = (purchase, sale) => {
  const profit = sale - purchase;
  const rate = purchase > 0 ? (profit / purchase) * 100 : 0;
  return { profit, profitRate: parseFloat(rate.toFixed(2)) };
};

const logStockChange = async (product, diff, reason, user) => {
  await StockLog.create({
    module: 'stock', action: 'adjust', targetId: product._id, targetName: product.name,
    changes: { before: product.stock - diff, after: product.stock, diff },
    reason, operator: { id: user._id, name: user.name, role: user.role }
  });
};

// 1. 创建商品
export const createProduct = async (data, user) => {
  const { purchasePrice, salePrice } = data;
  const { profit, profitRate } = calculateProfit(purchasePrice, salePrice);
  
  const product = new Product({
    ...data, profit, profitRate,
    lastPriceUpdateAt: new Date(),
    createdBy: user._id
  });
  
  await product.save();
  return product;
};

// 2. 更新商品（通用更新，匹配前端 PUT /products/:id）
export const updateProduct = async (id, data, user) => {
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  // 允许更新的字段
  const allowedFields = ['name', 'categoryId', 'purchasePrice', 'salePrice', 'stock', 'status', 'isMonitored', 'monitorInterval', 'minPurchasePlatform', 'maxSalePlatform'];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      product[field] = data[field];
    }
  }
  
  // 如果更新了价格，重新计算利润
  if (data.purchasePrice !== undefined || data.salePrice !== undefined) {
    const { profit, profitRate } = calculateProfit(
      data.purchasePrice ?? product.purchasePrice,
      data.salePrice ?? product.salePrice
    );
    product.profit = profit;
    product.profitRate = profitRate;
    product.lastPriceUpdateAt = new Date();
    
    // 同步更新未完成的回收任务价格
    await RecycleTask.updateMany(
      { productId: id, status: 'open' },
      { purchasePrice: product.purchasePrice, salePrice: product.salePrice, profit }
    );
  }
  
  await product.save();
  return product;
};

// 3. 更新价格与监控信息 (保留兼容)
export const updateProductPrice = async (id, data, user) => {
  return await updateProduct(id, data, user);
};

// 4. 获取商品列表 (带监控状态)
export const getProducts = async (query) => {
  const { category, status, search, monitor } = query;
  let filter = {};
  
  if (category && category !== 'all') filter.categoryId = new mongoose.Types.ObjectId(category);
  if (status && status !== 'all') filter.status = status;
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (monitor === 'true') filter.isMonitored = true;
  
  const products = await Product.find(filter).populate('categoryId').sort({ isMonitored: -1, lastPriceUpdateAt: 1 });
    
  const now = new Date();
  const result = products.map(p => {
    const item = p.toObject();
    if (item.isMonitored) {
      const hoursDiff = (now - new Date(item.lastPriceUpdateAt)) / (1000 * 60 * 60);
      item.isOverdue = hoursDiff > item.monitorInterval;
    } else {
      item.isOverdue = false;
    }
    return item;
  });
  
  // 排序：超时的红灯置顶
  result.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return 0;
  });
  
  return result;
};

// 5. 调整库存
export const adjustStock = async (id, newStock, reason, user) => {
  if (!reason) throw new Error('调整原因不能为空');
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const diff = newStock - product.stock;
  product.stock = newStock;
  await product.save();
  
  await logStockChange(product, diff, reason, user);
  
  // 库存不足通知
  if (newStock <= 5) {
    await notifyAdmins('⚠️ 库存预警', `商品【${product.name}】库存不足 ${newStock} 件！`, { type: 'low_stock', id: product._id });
  }
  
  return product;
};

// 6. 获取统计数据
export const getStockStats = async () => {
  const stats = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
        totalProfit: { $sum: '$profit' },
        lowStockCount: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] } },
        emptyStockCount: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
      }
    }
  ]);
  return stats;
};

// 7. 导出商品
export const exportProducts = async (query) => {
  const products = await getProducts(query);
  const headers = ['商品名称', '分类', '扫货价', '售卖价', '利润', '利润率', '库存', '监控状态', '状态'];
  const rows = products.map(p => [
    p.name, 
    p.categoryId?.name || '未分类', 
    p.purchasePrice, 
    p.salePrice, 
    p.profit, 
    `${p.profitRate}%`, 
    p.stock,
    p.isOverdue ? '超时未更新' : (p.isMonitored ? '正常' : '未开启'),
    p.status
  ]);
  return { headers, rows };
};

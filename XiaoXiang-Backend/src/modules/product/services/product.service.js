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
    lastPriceUpdateAt: new Date(), // 初始化更新时间
    createdBy: user._id
  });
  
  await product.save();
  return product;
};

// 2. 更新价格与监控信息 (核心逻辑)
export const updateProductPrice = async (id, data, user) => {
  const { purchasePrice, salePrice, minPurchasePlatform, maxSalePlatform, stock } = data;
  
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  // 计算新利润
  const { profit, profitRate } = calculateProfit(purchasePrice, salePrice);
  
  // 更新商品
  product.purchasePrice = purchasePrice;
  product.salePrice = salePrice;
  product.profit = profit;
  product.profitRate = profitRate;
  product.minPurchasePlatform = minPurchasePlatform;
  product.maxSalePlatform = maxSalePlatform;
  if (stock !== undefined) product.stock = stock;
  
  // 重置更新时间 (用于监控计时)
  product.lastPriceUpdateAt = new Date();
  
  await product.save();
  
  // ✅ 关键：同步更新未完成的回收任务价格
  await RecycleTask.updateMany(
    { productId: id, status: 'open' }, 
    { purchasePrice, salePrice, profit } // 更新任务中的价格快照
  );
  
  return product;
};

// 3. 获取商品列表 (带监控状态)
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
      // 判断是否超时
      item.isOverdue = hoursDiff > item.monitorInterval;
    } else {
      item.isOverdue = false;
    }
    return item;
  });
  
  // ✅ 排序：超时的红灯置顶
  result.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return 0;
  });
  
  return result;
};

// 4. 调整库存
export const adjustStock = async (id, newStock, reason, user) => {
  if (!reason) throw new Error('调整原因不能为空');
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const diff = newStock - product.stock;
  product.stock = newStock;
  await product.save();
  
  await logStockChange(product, diff, reason, user);
  
  // ✅ 库存不足通知
  if (newStock <= 5) {
    await notifyAdmins('⚠️ 库存预警', `商品【${product.name}】库存不足 ${newStock} 件！`, { type: 'low_stock', id: product._id });
  }
  
  return product;
};

// 5. 导出商品
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

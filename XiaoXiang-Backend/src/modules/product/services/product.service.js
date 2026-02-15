import Product from '../models/product.model.js';
import StockLog from '../models/stockLog.model.js';

const logOperation = async (module, action, target, changes, reason, user) => {
  await StockLog.create({
    module,
    action,
    targetId: target._id,
    targetName: target.name || target.orderNumber,
    changes,
    reason,
    operator: { id: user._id, name: user.name, role: user.role }
  });
};

export const createProduct = async (data, user) => {
  const product = new Product({ ...data, createdBy: user._id });
  await product.save();
  await logOperation('product', 'create', product, { after: product }, '新建商品', user);
  return product;
};

export const updateProduct = async (id, data, user) => {
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const before = product.toObject();
  Object.assign(product, data);
  await product.save();
  
  await logOperation('product', 'update', product, { before, after: product }, '更新商品信息', user);
  return product;
};

export const adjustStock = async (id, newStock, reason, user) => {
  if (!reason) throw new Error('调整原因不能为空');
  
  const product = await Product.findById(id);
  if (!product) throw new Error('商品不存在');
  
  const before = product.stock;
  product.stock = newStock;
  await product.save();
  
  await logOperation('stock', 'adjust', product, { before, after: newStock, diff: newStock - before }, reason, user);
  return product;
};

export const getProducts = async (query) => {
  const { category, status, search } = query;
  let filter = {};
  
  if (category && category !== 'all') filter.categoryId = category;
  if (status && status !== 'all') filter.status = status;
  if (search) filter.name = { $regex: search, $options: 'i' };
  
  return await Product.find(filter).sort({ createdAt: -1 });
};

export const getStockStats = async () => {
  return await Product.aggregate([
    { $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$stock', '$costPrice'] } },
        lowStockCount: { $sum: { $cond: [{ $lte: ['$stock', 5] }, 1, 0] } }
      }
    }
  ]);
};

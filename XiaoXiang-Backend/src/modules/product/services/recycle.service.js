import RecycleTask from '../models/recycleTask.model.js';
import RecycleOrder from '../models/recycleOrder.model.js';
import Product from '../models/product.model.js';
import StockLog from '../models/stockLog.model.js';

const logOperation = async (module, action, target, changes, reason, user) => {
  await StockLog.create({
    module, action, targetId: target._id, targetName: target.orderNumber || target.taskNumber,
    changes, reason, operator: { id: user._id, name: user.name, role: user.role }
  });
};

// 1. 管理员发布回收任务
export const publishTask = async (data, user) => {
  const { productId, recyclePrice, quantity, settleDays } = data;
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');
  
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const taskNumber = `TASK${dateStr}${random}`;
  
  const task = new RecycleTask({
    taskNumber, productId, productName: product.name,
    recyclePrice, quantity, settleDays,
    createdBy: user._id
  });
  
  await task.save();
  await logOperation('recycle_task', 'create', task, { after: task }, '发布回收任务', user);
  return task;
};

// 2. 用户接单 (模拟接口，供前端调用)
export const takeOrder = async (taskId, userId) => {
  const task = await RecycleTask.findById(taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status === 'closed') throw new Error('任务已关闭');
  
  const product = await Product.findById(task.productId);
  
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderNumber = `RC${dateStr}${random}`;
  
  const userProfit = (product.sellPrice - task.recyclePrice);
  const settleDeadline = new Date();
  settleDeadline.setDate(settleDeadline.getDate() + task.settleDays);
  
  const order = new RecycleOrder({
    orderNumber, taskId, productId: task.productId, productName: task.productName,
    userId, // 这里应该是实际用户的ID
    quantity: 1, // 默认接单数量为1
    recyclePrice: task.recyclePrice,
    userProfit,
    settleDeadline,
    status: 'pending'
  });
  
  await order.save();
  
  // 更新任务已接数量
  task.settledQuantity += 1;
  if (task.settledQuantity >= task.quantity) task.status = 'closed';
  await task.save();
  
  return order;
}

// 3. 获取订单列表
export const getOrders = async (query) => {
  const { status, search } = query;
  let filter = {};
  
  if (status && status !== 'all') filter.status = status;
  if (search) {
    filter.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { productName: { $regex: search, $options: 'i' } }
    ];
  }
  
  return await RecycleOrder.find(filter).sort({ createdAt: -1 });
};

// 4. 更新订单状态
export const updateStatus = async (id, status, reason, user) => {
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  
  const before = order.status;
  order.status = status;
  
  if (status === 'paid') order.paidAt = new Date();
  if (status === 'shipped') order.shippedAt = new Date();
  if (status === 'received') order.receivedAt = new Date();
  if (status === 'settled') order.settledAt = new Date();
  
  await order.save();
  await logOperation('order', 'status_change', order, { before, after: status }, reason || '状态变更', user);
  
  return order;
};

// 5. 绑定售卖信息
export const bindSaleInfo = async (id, data, user) => {
  const { platformName, platformOrderNo, salePrice } = data;
  
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  
  const before = order.saleBindInfo;
  order.saleBindInfo = {
    platformName,
    platformOrderNo,
    salePrice,
    bindAt: new Date(),
    bindBy: user._id
  };
  order.status = 'bound';
  
  await order.save();
  await logOperation('order', 'bind_sale', order, { before, after: order.saleBindInfo }, '绑定售卖订单', user);
  
  return order;
};

// 新增：获取公开任务列表逻辑
export const getOpenTasks = async (category, sort) => {
  let filter = { status: 'open' };
  
  const tasks = await RecycleTask.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    // 分类筛选
    { $match: category && category !== 'all' ? { 'productInfo.categoryId': category } : {} },
    // 计算利润
    {
      $addFields: {
        userProfit: { $subtract: ['$productInfo.sellPrice', '$recyclePrice'] }
      }
    },
    // 排序
    { $sort: sort === 'commission' ? { userProfit: -1 } : { createdAt: -1 } }
  ]);

  return tasks;
};

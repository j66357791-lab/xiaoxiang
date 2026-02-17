import RecycleTask from '../models/recycleTask.model.js';
import RecycleOrder from '../models/recycleOrder.model.js';
import Product from '../models/product.model.js';
import StockLog from '../models/stockLog.model.js';
import mongoose from 'mongoose';

// 记录操作日志
const logOperation = async (module, action, target, changes, reason, user) => {
  await StockLog.create({
    module,
    action,
    targetId: target._id,
    targetName: target.orderNumber || target.taskNumber,
    changes,
    reason,
    operator: { id: user._id, name: user.name, role: user.role }
  });
};

// ==================== 回收任务服务 ====================

// 发布回收任务
export const publishTask = async (data, user) => {
  const { productId, recyclePrice, quantity, settleDays } = data;
  
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const taskNumber = `TASK${dateStr}${random}`;
  
  const userProfit = (product.salePrice || 0) - (recyclePrice || 0);
  
  const task = new RecycleTask({
    taskNumber,
    productId,
    productName: product.name,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    recyclePrice,
    userProfit,
    quantity: quantity || 1,
    settleDays: settleDays || 7,
    createdBy: user._id
  });
  
  await task.save();
  await logOperation('recycle_task', 'create', task, { after: task }, '发布回收任务', user);
  
  return task;
};

// 获取任务列表
export const getTasks = async (query) => {
  const { status } = query;
  let filter = {};
  
  if (status) {
    filter.status = status;
  }
  
  const tasks = await RecycleTask.find(filter)
    .populate('productId', 'name purchasePrice salePrice')
    .sort({ createdAt: -1 });
  
  return tasks;
};

// 获取开放任务（用户端）
export const getOpenTasks = async (query) => {
  const { category, sort } = query;
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
    {
      $match: category && category !== 'all' 
        ? { 'productInfo.categoryId': new mongoose.Types.ObjectId(category) } 
        : {}
    },
    {
      $addFields: {
        userProfit: { $subtract: ['$salePrice', '$recyclePrice'] }
      }
    },
    {
      $sort: sort === 'profit' ? { userProfit: -1 } : { createdAt: -1 }
    }
  ]);
  
  return tasks;
};

// ==================== 订单服务 ====================

// 用户接单
export const takeOrder = async (taskId, userId) => {
  const task = await RecycleTask.findById(taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status === 'closed') throw new Error('任务已关闭');
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderNumber = `RC${dateStr}${random}`;
  
  const settleDeadline = new Date();
  settleDeadline.setDate(settleDeadline.getDate() + task.settleDays);
  
  const order = new RecycleOrder({
    orderNumber,
    taskId,
    productId: task.productId,
    productName: task.productName,
    userId,
    quantity: 1,
    purchasePrice: task.purchasePrice,
    salePrice: task.salePrice,
    recyclePrice: task.recyclePrice,
    userProfit: task.userProfit,
    settleDeadline,
    status: 'pending'
  });
  
  await order.save();
  
  task.settledQuantity += 1;
  if (task.settledQuantity >= task.quantity) {
    task.status = 'closed';
  }
  await task.save();
  
  return order;
};

// 获取订单列表
export const getOrders = async (query) => {
  const { status, search } = query;
  let filter = {};
  
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (search) {
    filter.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { productName: { $regex: search, $options: 'i' } }
    ];
  }
  
  const orders = await RecycleOrder.find(filter)
    .populate('userId', 'name phone')
    .sort({ createdAt: -1 });
  
  return orders;
};

// 更新订单状态
export const updateStatus = async (id, status, reason, user) => {
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  
  const before = order.status;
  order.status = status;
  
  if (status === 'settled') {
    order.settledAt = new Date();
  }
  
  await order.save();
  await logOperation('order', 'status_change', order, { before, after: status }, reason || '状态变更', user);
  
  return order;
};

// 绑定售卖信息
export const bindSaleInfo = async (id, data, user) => {
  const { platform, orderNo, salePrice } = data;
  
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  
  const before = order.bindInfo;
  
  order.bindInfo = {
    platform,
    orderNo,
    salePrice,
    bindAt: new Date(),
    bindBy: user._id
  };
  order.status = 'bound';
  
  await order.save();
  await logOperation('order', 'bind_sale', order, { before, after: order.bindInfo }, '绑定售卖订单', user);
  
  return order;
};

// 审核订单
export const reviewOrder = async (id, approved, remark, user) => {
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  
  const status = approved ? 'approved' : 'rejected';
  order.status = status;
  
  if (remark) {
    order.adminRemark = remark;
  }
  
  await order.save();
  await logOperation('order', 'review', order, { approved }, remark || (approved ? '审核通过' : '审核驳回'), user);
  
  return order;
};

// 更新备注
export const updateRemark = async (id, remark, user) => {
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  
  order.adminRemark = remark;
  await order.save();
  
  return order;
};

// 确认收货
export const confirmReceive = async (id, user) => {
  return updateStatus(id, 'received', '管理员确认收货', user);
};

// 确认结算
export const confirmSettle = async (id, user) => {
  return updateStatus(id, 'settled', '管理员确认结算', user);
};

export default {
  publishTask,
  getTasks,
  getOpenTasks,
  takeOrder,
  getOrders,
  updateStatus,
  bindSaleInfo,
  reviewOrder,
  updateRemark,
  confirmReceive,
  confirmSettle
};

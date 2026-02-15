import RecycleTask from '../models/recycleTask.model.js';
import RecycleOrder from '../models/recycleOrder.model.js';
import Product from '../models/product.model.js';
import StockLog from '../models/stockLog.model.js';  // 修复：添加 .model 后缀
import User from '../../users/user.model.js';
import { notifyAdmins } from './notification.service.js';
import { sendPushNotification } from '../../../common/utils/push.js';

const logOperation = async (module, action, target, changes, reason, user) => {
  await StockLog.create({
    module, action, targetId: target._id, targetName: target.orderNumber || target.taskNumber,
    changes, reason, operator: { id: user._id, name: user.name, role: user.role }
  });
};

export const publishTask = async (data, user) => {
  const { productId, recyclePrice, quantity, settleDays } = data;
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');

  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const taskNumber = `TASK${dateStr}${random}`;

  const task = new RecycleTask({
    taskNumber, productId, productName: product.name,
    purchasePrice: product.purchasePrice, // 记录当前扫货价
    salePrice: product.salePrice,         // 记录当前售卖价
    recyclePrice, quantity, settleDays, createdBy: user._id
  });
  await task.save();
  await logOperation('recycle_task', 'create', task, { after: task }, '发布回收任务', user);
  return task;
};

export const takeOrder = async (taskId, userId) => {
  const task = await RecycleTask.findById(taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status === 'closed') throw new Error('任务已关闭');

  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderNumber = `RC${dateStr}${random}`;
  const userProfit = (task.salePrice - task.recyclePrice);
  const settleDeadline = new Date();
  settleDeadline.setDate(settleDeadline.getDate() + task.settleDays);

  const order = new RecycleOrder({
    orderNumber, taskId, productId: task.productId, productName: task.productName,
    userId, quantity: 1, recyclePrice: task.recyclePrice, userProfit, settleDeadline, status: 'pending'
  });
  await order.save();

  task.settledQuantity += 1;
  if (task.settledQuantity >= task.quantity) task.status = 'closed';
  await task.save();

  // ✅ 通知管理员：用户接单了
  await notifyAdmins('📢 新订单通知', `用户接单了 ${task.productName}，请及时处理！`, { type: 'new_order', id: order._id });

  // ✅ 通知用户接单成功
  try {
    const user = await User.findById(userId).select('pushToken');
    if (user && user.pushToken) {
      await sendPushNotification(
        user.pushToken,
        '接单成功',
        `亲爱的小象用户，恭喜您已经成功接单任务「${task.productName}」，可前往个人中心我的订单页面处进行查看。`,
        { type: 'order', orderId: order._id.toString(), action: 'view_order' }
      );
      console.log(`[通知] 用户 ${userId} 接单成功通知已发送`);
    }
  } catch (err) {
    console.error('[通知] 发送用户接单成功通知失败:', err);
    // 不影响主流程，继续执行
  }

  return order;
};

export const getOrders = async (query) => {
  const { status, search } = query;
  let filter = {};
  if (status && status !== 'all') filter.status = status;
  if (search) filter.$or = [{ orderNumber: { $regex: search, $options: 'i' } }, { productName: { $regex: search, $options: 'i' } }];
  return await RecycleOrder.find(filter).sort({ createdAt: -1 });
};

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

export const bindSaleInfo = async (id, data, user) => {
  const { platformName, platformOrderNo, salePrice } = data;
  const order = await RecycleOrder.findById(id);
  if (!order) throw new Error('订单不存在');
  const before = order.saleBindInfo;
  order.saleBindInfo = { platformName, platformOrderNo, salePrice, bindAt: new Date(), bindBy: user._id };
  order.status = 'bound';
  await order.save();
  await logOperation('order', 'bind_sale', order, { before, after: order.saleBindInfo }, '绑定售卖订单', user);
  return order;
};

export const getOpenTasks = async (category, sort) => {
  let filter = { status: 'open' };
  return await RecycleTask.aggregate([
    { $match: filter },
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'productInfo' } },
    { $unwind: '$productInfo' },
    { $match: category && category !== 'all' ? { 'productInfo.categoryId': category } : {} },
    { $addFields: { userProfit: { $subtract: ['$salePrice', '$recyclePrice'] } } },
    { $sort: sort === 'commission' ? { userProfit: -1 } : { createdAt: -1 } }
  ]);
};

export const exportOrders = async (query) => {
  const orders = await getOrders(query);
  const headers = ['订单号', '商品名', '用户', '状态', '回收价', '利润', '绑定平台', '绑定单号', '创建时间'];
  const rows = orders.map(o => [
    o.orderNumber, o.productName, o.userName, o.status, o.recyclePrice, o.userProfit,
    o.saleBindInfo?.platformName || '无', o.saleBindInfo?.platformOrderNo || '无',
    new Date(o.createdAt).toLocaleString()
  ]);
  return { headers, rows };
};

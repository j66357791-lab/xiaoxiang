import express from 'express';
import User from '../model/User.js';
import Category from '../model/Category.js';
import TaskType from '../model/TaskType.js';
import Job from '../model/Job.js';
import Order from '../model/Order.js';

const router = express.Router();

// ===============================
// 分类管理
// ===============================
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/category', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '分类名称不能为空' });
    const category = new Category({ name, color: color || '#4364F7' });
    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/category/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 任务类型管理
// ===============================
router.get('/task-types', async (req, res) => {
  try {
    const taskTypes = await TaskType.find().sort({ createdAt: -1 });
    res.json({ success: true, data: taskTypes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/task-type', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '类型名称不能为空' });
    const taskType = new TaskType({ name, color: color || '#FF9800' });
    await taskType.save();
    res.status(201).json({ success: true, data: taskType });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/task-type/:id', async (req, res) => {
  try {
    await TaskType.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 任务管理
// ===============================
router.post('/job', async (req, res) => {
  try {
    console.log('='.repeat(50));
    console.log('[Admin] 收到发布任务请求 (Base64模式)...');
    const { title, content, categoryId, amount, totalSlots, authorId, deadlineHours, type, amountLevels, steps, contentImages } = req.body;
    
    let parsedAmountLevels = [];
    if (typeof amountLevels === 'string') parsedAmountLevels = JSON.parse(amountLevels);
    else if (Array.isArray(amountLevels)) parsedAmountLevels = amountLevels;
    
    let parsedSteps = [];
    if (typeof steps === 'string') parsedSteps = JSON.parse(steps);
    else if (Array.isArray(steps)) parsedSteps = steps;
    
    let finalAmount = amount;
    if (!finalAmount && parsedAmountLevels.length > 0) finalAmount = parsedAmountLevels[0].amount;

    if (!title || !content || !categoryId || !finalAmount || !totalSlots || !deadlineHours) {
        return res.status(400).json({ success: false, message: '参数不完整' });
    }

    const deadline = new Date(Date.now() + parseInt(deadlineHours) * 60 * 60 * 1000);

    const job = new Job({
      title: title.trim(),
      content: content.trim(),
      category: categoryId,
      type: type || 'single',
      amount: parseFloat(finalAmount),
      totalSlots: parseInt(totalSlots),
      author: authorId || null,
      deadline: deadline,
      deadlineHours: parseInt(deadlineHours),
      isFrozen: false,
      contentImages: Array.isArray(contentImages) ? contentImages : [],
      steps: parsedSteps,
      amountLevels: parsedAmountLevels
    });
    
    await job.save();
    console.log(`[Admin] 兼职发布成功! ID: ${job._id}`);
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    console.error('[Admin] 发布兼职失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().populate('category', 'name color').sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/job/freeze/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: '任务不存在' });
    job.isFrozen = !job.isFrozen;
    await job.save();
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/job/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 订单管理
// ===============================
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'email name')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 👇 新增：获取单个订单详情（用于 Modal）
router.get('/order/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'email name').populate('jobId', 'title');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 👇 核心：修改订单状态（包含打款逻辑）
router.patch('/order/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效的订单状态' });
    }

    const order = await Order.findById(orderId).populate('userId');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });

    // 🛑 核心逻辑：如果是确认打款，给用户加钱
    if (status === 'Completed' && order.status !== 'Completed') {
      const amount = order.jobSnapshot.amount;
      console.log(`[Admin] 确认打款逻辑触发: 用户 ${order.userId.email}, 金额 ¥${amount}`);
      
      try {
        // 调用 User 模型的方法增加余额
        await order.userId.addBalance(amount);
        order.completedAt = new Date();
        console.log(`[Admin] 打款成功，用户余额已更新`);
      } catch (balanceErr) {
        console.error('[Admin] 加款失败:', balanceErr);
        return res.status(500).json({ success: false, message: '加款失败: ' + balanceErr.message });
      }
    } else if (status === 'PendingPayment') {
       console.log(`[Admin] 订单审核通过，进入待打款阶段: ${orderId}`);
    }

    order.status = status;
    await order.save();

    // 重新查询一次以返回最新的用户数据（包含新余额）
    const updatedOrder = await Order.findById(orderId).populate('userId', 'email name balance');

    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    console.error('[Admin] 更新订单失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

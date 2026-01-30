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

// 手动添加分类
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

// 删除分类 (新增)
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

// 手动添加类型
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
// 任务管理 (Job Management)
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

// 获取所有发布的任务（管理员后台“任务管理”用）
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
// 订单管理 (Order Management - 全局汇总)
// ===============================
router.get('/orders', async (req, res) => {
  try {
    // 获取所有订单，包含接单人和关联任务信息
    const orders = await Order.find()
      .populate('userId', 'email name') // 关联查询用户信息
      .populate('jobId', 'title')      // 关联查询任务标题
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 修改订单状态
router.patch('/order/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: '无效的订单状态' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

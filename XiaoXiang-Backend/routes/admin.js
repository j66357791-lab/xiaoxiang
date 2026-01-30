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
    const category = new Category(req.body);
    await category.save();
    res.status(201).json({ success: true, data: category });
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
    const taskType = new TaskType(req.body);
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
// 任务管理 (修改为 Base64 存储)
// ===============================
router.post('/job', async (req, res) => {
  try {
    console.log('='.repeat(50));
    console.log('[Admin] 收到发布任务请求 (Base64模式)...');
    
    const { title, content, categoryId, amount, totalSlots, authorId, deadlineHours, type, amountLevels, steps, contentImages } = req.body;
    
    // 解析 JSON 字段
    let parsedAmountLevels = [];
    if (typeof amountLevels === 'string') {
        parsedAmountLevels = JSON.parse(amountLevels);
    } else if (Array.isArray(amountLevels)) {
        parsedAmountLevels = amountLevels;
    }
    
    let parsedSteps = [];
    if (typeof steps === 'string') {
        parsedSteps = JSON.parse(steps);
    } else if (Array.isArray(steps)) {
        parsedSteps = steps;
    }
    
    // 提取金额
    let finalAmount = amount;
    if (!finalAmount && parsedAmountLevels.length > 0) {
        finalAmount = parsedAmountLevels[0].amount;
    }

    // 参数校验
    if (!title || !content || !categoryId || !finalAmount || !totalSlots || !deadlineHours) {
        console.error('[Admin] 参数缺失', { hasTitle: !!title, hasContent: !!content, hasCategory: !!categoryId, hasAmount: !!finalAmount, hasTotalSlots: !!totalSlots, hasDeadline: !!deadlineHours });
        return res.status(400).json({ success: false, message: '参数不完整，请检查必填项' });
    }

    // 计算截止时间
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
      
      // 👇 直接保存 Base64 字符串数组
      contentImages: Array.isArray(contentImages) ? contentImages : [],
      
      steps: parsedSteps,
      amountLevels: parsedAmountLevels
    });
    
    await job.save();
    console.log(`[Admin] 兼职发布成功! ID: ${job._id}`);
    console.log('='.repeat(50));
    
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    console.error('[Admin] 发布兼职失败:', err.message);
    console.error(err.stack);
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
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const query = {};
    if (status && status !== 'All') query.status = status;
    if (search) query.orderNumber = { $regex: search, $options: 'i' };
    
    const orders = await Order.find(query)
      .populate('userId', 'email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Order.countDocuments(query);
    res.json({ success: true, data: orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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

// 初始化超级管理员
router.post('/init', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: '用户已存在' });
    const admin = new User({ email, password, name, role: 'superAdmin' });
    await admin.save();
    res.status(201).json({ success: true, message: '超级管理员创建成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

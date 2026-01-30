import express from 'express';
import User from '../model/User.js';
import Category from '../model/Category.js';
import TaskType from '../model/TaskType.js'; // 必须引入
import Job from '../model/Job.js';
import Order from '../model/Order.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// ===============================
// 分类管理
// ===============================
router.get('/categories', async (req, res) => {
  try {
    console.log('[Admin] 正在获取分类列表...');
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('[Admin] 获取分类失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/category', async (req, res) => {
  try {
    const { name, color } = req.body;
    const category = new Category({ name, color });
    await category.save();
    console.log(`[Admin] 分类添加成功 ID: ${category._id}`);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error('[Admin] 添加分类失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 任务类型管理 (新增修复 404)
// ===============================
router.get('/task-types', async (req, res) => {
  try {
    console.log('[Admin] 正在获取任务类型列表...');
    const taskTypes = await TaskType.find().sort({ createdAt: -1 });
    res.json({ success: true, data: taskTypes });
  } catch (err) {
    console.error('[Admin] 获取任务类型失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/task-type', async (req, res) => {
  try {
    const { name, color } = req.body;
    const taskType = new TaskType({ name, color });
    await taskType.save();
    console.log(`[Admin] 任务类型添加成功 ID: ${taskType._id}`);
    res.status(201).json({ success: true, data: taskType });
  } catch (err) {
    console.error('[Admin] 添加任务类型失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/task-type/:id', async (req, res) => {
  try {
    await TaskType.findByIdAndDelete(req.params.id);
    console.log(`[Admin] 任务类型删除成功 ID: ${req.params.id}`);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    console.error('[Admin] 删除任务类型失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 任务管理 (发布/编辑/冻结/删除)
// ===============================
router.post('/job', upload.array('contentImages'), async (req, res) => {
  try {
    console.log('[Admin] 收到发布任务请求...');
    const { title, content, categoryId, amount, totalSlots, authorId, deadlineHours } = req.body;
    const contentImages = req.files ? req.files.map(file => file.path) : [];

    // 参数校验
    if (!title || !content || !categoryId || !amount || !totalSlots || !deadlineHours) {
        console.warn('[Admin] 发布失败: 参数不完整');
        return res.status(400).json({ success: false, message: '参数不完整，请检查必填项' });
    }

    // 计算截止时间：从发布时间开始，加上指定的小时数
    const deadline = new Date(Date.now() + parseInt(deadlineHours) * 60 * 60 * 1000);
    console.log(`[Admin] 计算截止时间: ${deadlineHours}小时后 -> ${deadline}`);

    const job = new Job({
      title,
      content,
      category: categoryId,
      amount: parseFloat(amount),
      totalSlots: parseInt(totalSlots),
      author: authorId,
      deadline: deadline,
      deadlineHours: parseInt(deadlineHours),
      isFrozen: false,
      contentImages: contentImages
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
    console.log('[Admin] 正在获取任务列表...');
    const jobs = await Job.find().populate('category', 'name color').sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (err) {
    console.error('[Admin] 获取任务列表失败:', err.message);
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
    console.error('[Admin] 更新任务状态失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/job/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    console.error('[Admin] 删除任务失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 订单管理 (管理员查看/审核)
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
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[Admin] 获取订单列表失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/order/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效的订单状态' });
    }
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    res.json({ success: true, data: order });
  } catch (err) {
    console.error('[Admin] 更新订单状态失败:', err.message);
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
    console.error('[Admin] 初始化管理员失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

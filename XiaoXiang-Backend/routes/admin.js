import express from 'express';
import User from '../model/User.js';
import Category from '../model/Category.js';
import Job from '../models/Job.js';

const router = express.Router();

// 0. 获取所有分类 (新增：给前端下拉框用)
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

// 1. 添加分类 (管理员)
router.post('/category', async (req, res) => {
  try {
    const { name, color } = req.body;
    console.log(`[Admin] 正在添加分类: ${name}, 颜色: ${color}`);
    
    const category = new Category({ name, color });
    await category.save();
    
    console.log(`[Admin] 分类添加成功 ID: ${category._id}`);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error('[Admin] 添加分类失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. 发布兼职任务 (管理员)
router.post('/job', async (req, res) => {
  try {
    // 👇 打印详细日志，方便调试
    console.log('[Admin] 收到发布任务请求...');
    console.log('[Admin] 请求参数:', JSON.stringify(req.body));

    const { title, content, categoryId, amount, totalSlots, authorId } = req.body;

    // 参数校验日志
    if (!title || !content || !categoryId || !amount || !totalSlots) {
        console.warn('[Admin] 发布失败: 参数不完整');
        return res.status(400).json({ success: false, message: '参数不完整，请检查必填项' });
    }

    const job = new Job({
      title,
      content,
      category: categoryId,
      amount: parseFloat(amount),
      totalSlots: parseInt(totalSlots),
      author: authorId
    });
    
    await job.save();
    console.log(`[Admin] 兼职发布成功! ID: ${job._id}, 标题: ${title}`);
    
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    console.error('[Admin] 发布兼职失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. 冻结/解冻任务
router.patch('/job/freeze/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: '任务不存在' });
    
    job.isFrozen = !job.isFrozen;
    await job.save();
    
    console.log(`[Admin] 任务状态更新 ID: ${job._id}, 冻结状态: ${job.isFrozen}`);
    res.json({ success: true, data: job });
  } catch (err) {
    console.error('[Admin] 更新任务状态失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. 删除任务
router.delete('/job/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    console.log(`[Admin] 任务删除成功 ID: ${req.params.id}`);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    console.error('[Admin] 删除任务失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. 获取所有任务列表 (给管理员后台用)
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

// 初始化超级管理员接口 (之前提供的)
router.post('/init', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: '用户已存在' });

    const admin = new User({ email, password, name, role: 'superAdmin' });
    await admin.save();
    console.log('[Admin] 超级管理员初始化成功:', email);
    res.status(201).json({ success: true, message: '超级管理员创建成功' });
  } catch (err) {
    console.error('[Admin] 初始化管理员失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

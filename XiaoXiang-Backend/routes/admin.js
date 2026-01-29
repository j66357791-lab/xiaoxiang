import express from 'express';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Job from '../models/Job.js';

const router = express.Router();

// 1. 初始化超级管理员 (仅测试用，之后可注释掉)
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

// 2. 添加分类 (管理员)
router.post('/category', async (req, res) => {
  try {
    const { name, color } = req.body;
    const category = new Category({ name, color });
    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. 发布兼职任务 (管理员)
router.post('/job', async (req, res) => {
  try {
    const { title, content, categoryId, amount, totalSlots, authorId } = req.body;
    const job = new Job({
      title,
      content,
      category: categoryId,
      amount,
      totalSlots,
      author: authorId
    });
    await job.save();
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. 冻结/解冻任务
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

// 5. 删除任务
router.delete('/job/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取所有任务列表 (给管理员后台用)
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().populate('category', 'name');
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

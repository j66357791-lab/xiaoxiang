import express from 'express';
import Job from '../models/Job.js';
import Order from '../models/Order.js';

const router = express.Router();

// 1. 获取兼职大厅列表 (用户)
router.get('/', async (req, res) => {
  try {
    // 即使是冻结的任务也返回，前端判断显示上锁
    const jobs = await Job.find().populate('category', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. 接单 (用户)
router.post('/:id/apply', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { userId } = req.body;

    const job = await Job.findById(jobId);
    
    if (!job) return res.status(404).json({ message: '任务不存在' });
    if (job.isFrozen) return res.status(403).json({ message: '该任务已冻结，无法接单' });
    if (job.appliedCount >= job.totalSlots) return res.status(403).json({ message: '名额已满' });

    // 生成订单号
    const orderNumber = 'ORD' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);

    // 创建订单
    const order = new Order({
      orderNumber,
      userId,
      jobId,
      jobSnapshot: {
        title: job.title,
        amount: job.amount,
        categoryName: job.category.name // 假设已 populate 或通过 id 查
      }
    });

    await order.save();

    // 更新任务已接单数
    job.appliedCount += 1;
    await job.save();

    res.status(201).json({ success: true, message: '接单成功', data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

import express from 'express';
import Job from '../model/Job.js';
import Order from '../model/Order.js';

const router = express.Router();

// 1. 获取兼职大厅列表 (用户端)
router.get('/', async (req, res) => {
  try {
    console.log('[Jobs] 获取任务列表...');
    // 获取所有任务，包含分类信息，按时间倒序
    const jobs = await Job.find().populate('category', 'name color').sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (err) {
    console.error('[Jobs] 获取列表失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. 接单 (用户端)
router.post('/:id/apply', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { userId } = req.body;

    console.log(`[Jobs] 用户 ${userId} 尝试接单任务 ${jobId}`);

    // 查找任务
    const job = await Job.findById(jobId);
    
    if (!job) return res.status(404).json({ success: false, message: '任务不存在' });
    if (job.isFrozen) return res.status(403).json({ success: false, message: '该任务已冻结，无法接单' });
    if (job.appliedCount >= job.totalSlots) return res.status(403).json({ success: false, message: '名额已满' });

    // 生成订单号
    const orderNumber = 'ORD' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);

    // 创建订单
    const order = new Order({
      orderNumber,
      userId,
      jobId,
      status: 'Applied', // 初始状态为已接单
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

    console.log(`[Jobs] 接单成功，订单号: ${orderNumber}`);
    res.status(201).json({ success: true, message: '接单成功', data: order });
  } catch (err) {
    console.error('[Jobs] 接单失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

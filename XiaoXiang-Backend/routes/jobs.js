import express from 'express';
import Job from '../model/Job.js';
import Order from '../model/Order.js';

const router = express.Router();

// 获取所有任务
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().populate('category', 'name color').sort({ createdAt: -1 });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取单个任务详情
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('category', 'name color');
    if (!job) return res.status(404).json({ success: false, message: '任务不存在' });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 接单接口 (修复阶梯价格适配)
router.post('/apply', async (req, res) => {
  try {
    const { jobId, userId, levelIndex } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: '任务不存在' });
    if (job.isFrozen) return res.status(400).json({ success: false, message: '任务已冻结' });
    if (job.appliedCount >= job.totalSlots) return res.status(400).json({ success: false, message: '名额已满' });
    
    // 检查是否已接单
    const existingOrder = await Order.findOne({ userId, jobId });
    if (existingOrder) return res.status(400).json({ success: false, message: '您已接过此任务' });

    // 阶梯价格适配逻辑
    let finalAmount = job.amount;
    let selectedLevelName = "一级";
    
    if (job.amountLevels && job.amountLevels.length > 0) {
      // 如果有阶梯，且前端传了 levelIndex，则用指定的，否则默认用第一个
      const idx = (levelIndex !== undefined && levelIndex !== null) ? parseInt(levelIndex) : 0;
      const level = job.amountLevels[idx] || job.amountLevels[0];
      finalAmount = level.amount;
      selectedLevelName = level.level;
    }

    // 创建订单
    const order = new Order({
      userId,
      jobId,
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'Applied',
      jobSnapshot: {
        title: job.title,
        amount: finalAmount,
        categoryName: selectedLevelName // 保存选中的等级名称到快照
      }
    });

    await order.save();

    // 增加任务接单人数
    job.appliedCount += 1;
    await job.save();

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error('[Jobs] 接单失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

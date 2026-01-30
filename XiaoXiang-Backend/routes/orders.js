import express from 'express';
import Order from '../model/Order.js';

const router = express.Router();

// 获取用户的订单列表
router.get('/my', async (req, res) => {
  try {
    const { userId } = req.query;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取管理员订单列表（带搜索和筛选）
router.get('/admin', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新订单状态
router.patch('/:id/status', async (req, res) => {
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 取消订单
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    // 只允许在 Applied 状态下取消
    if (order.status !== 'Applied') {
      return res.status(400).json({ success: false, message: '只有未提交的订单可以取消' });
    }
    
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '订单已取消' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

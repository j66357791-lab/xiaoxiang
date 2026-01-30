import express from 'express';
import Order from '../model/Order.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 1. 获取用户的订单列表
router.get('/my', async (req, res) => {
  try {
    const { userId } = req.query;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. 提交订单 (用户上传凭证)
router.post('/submit', upload.single('evidence'), async (req, res) => {
  try {
    const { orderId, description } = req.body;
    const evidence = req.file ? req.file.path : null;

    console.log(`[Orders] 收到提交请求, Order ID: ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    if (order.status !== 'Applied') {
      return res.status(400).json({ success: false, message: '该订单已提交或无法修改' });
    }

    // 更新订单状态为 Reviewing (审批中)
    order.status = 'Reviewing';
    order.description = description;
    order.evidence = evidence;

    await order.save();
    
    console.log(`[Orders] 订单提交成功: ${order.orderNumber}`);
    res.json({ success: true, message: '提交成功，请等待审核', data: order });
  } catch (err) {
    console.error('[Orders] 提交订单失败:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. 获取管理员订单列表（带搜索和筛选）
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

// 4. 更新订单状态
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

// 5. 取消订单
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

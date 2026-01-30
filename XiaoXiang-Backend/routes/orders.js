import express from 'express';
import multer from 'multer';
import path from 'path';
import Order from '../model/Order.js';
import User from '../model/User.js';

const router = express.Router();

// ===============================
// 1. 文件上传配置 (Multer)
// ===============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'order-evidence-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 👈 修改点：限制最多 9 张图片
const upload = multer({ storage: storage }).array('evidence', 9);

// ===============================
// 2. 用户端接口
// ===============================

// 获取我的订单
router.get('/my', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: '缺少用户ID' });
    
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('[Orders] 获取订单失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 提交订单 (上传凭证，支持多图)
router.post('/submit', upload, async (req, res) => {
  console.log('========================================');
  console.log('[Orders] 收到订单提交请求');
  
  try {
    const { orderId, userId, description } = req.body;
    
    // 👈 修改点 1：验证描述长度 (200字)
    if (description && description.length > 200) {
      return res.status(400).json({ success: false, message: '任务描述不能超过200字' });
    }

    // 👈 修改点 2：验证图片数量 (最多9张)
    if (req.files && req.files.length > 9) {
      return res.status(400).json({ success: false, message: '最多只能上传9张图片' });
    }

    const order = await Order.findById(orderId).populate('userId');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    // 权限检查
    if (order.userId._id.toString() !== userId) {
      console.log('[Orders] 错误: 用户ID不匹配');
      return res.status(403).json({ success: false, message: '无权操作该订单' });
    }
    
    if (order.status !== 'Applied') {
      console.log('[Orders] 错误: 订单状态异常', order.status);
      return res.status(400).json({ success: false, message: '当前状态不允许提交' });
    }

    // 👈 修改点 3：1分钟冷却逻辑
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentOrder = await Order.findOne({
      userId: userId,
      submittedAt: { $gte: oneMinuteAgo }
    });

    if (recentOrder) {
      console.log('[Orders] 错误: 提交频率过快');
      return res.status(429).json({ success: false, message: '提交过于频繁，请1分钟后再试' });
    }

    // 处理图片路径数组
    let evidencePaths = [];
    if (req.files && req.files.length > 0) {
      evidencePaths = req.files.map(file => `/uploads/${file.filename}`);
      console.log('[Orders] 凭证已保存:', evidencePaths.length, '张');
    }

    // 系统自动判断逻辑
    let newStatus = 'Submitted';
    if (description && description.trim() !== '' && evidencePaths.length > 0) {
      newStatus = 'Reviewing';
      console.log('[Orders] 资料完整，自动进入 [审批中]');
    } else {
      console.log('[Orders] 资料不完整，保持 [已提交]');
    }

    order.description = description;
    order.evidence = evidencePaths;
    order.status = newStatus;

    await order.save();
    console.log('[Orders] 订单更新成功:', order.status);

    res.json({ success: true, data: order, message: '提交成功' });
  } catch (err) {
    console.error('[Orders] 提交失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除订单 (用户取消)
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    // 实际逻辑中，可能需要校验权限，这里简化为直接修改状态
    order.status = 'Cancelled';
    order.cancelledAt = new Date();
    await order.save();
    
    res.json({ success: true, message: '已取消订单' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 3. 管理员接口
// ===============================

// 获取所有订单列表
router.get('/admin', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (status && status !== 'All') query.status = status;
    if (search) query.orderNumber = { $regex: search, $options: 'i' };
    
    const orders = await Order.find(query)
      .populate('userId', 'email name')
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

// 获取单个订单详情
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'email name').populate('jobId', 'title');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新订单状态 (包含打款逻辑)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效的订单状态' });
    }
    
    const order = await Order.findById(req.params.id).populate('userId');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    // 确认打款逻辑
    if (status === 'Completed' && order.status !== 'Completed') {
      const amount = order.jobSnapshot.amount;
      console.log(`[Orders] 触发打款: 用户 ${order.userId.email}, 金额 ¥${amount}`);
      
      try {
        await order.userId.addBalance(amount);
        order.completedAt = new Date();
      } catch (balanceErr) {
        console.error('[Orders] 加款失败:', balanceErr);
        return res.status(500).json({ success: false, message: '加款失败: ' + balanceErr.message });
      }
    }
    
    order.status = status;
    await order.save();
    
    const updatedOrder = await Order.findById(req.params.id).populate('userId', 'email name balance');
    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

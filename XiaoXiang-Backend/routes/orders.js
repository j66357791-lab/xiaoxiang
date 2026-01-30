import express from 'express';
import multer from 'multer';
import path from 'path';
import Order from '../model/Order.js';
import User from '../model/User.js'; // 👈 必须引入 User 模型用于加余额

const router = express.Router();

// ===============================
// 1. 文件上传配置 (Multer)
// ===============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：order-evidence-时间戳-随机数.后缀
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'order-evidence-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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

// 提交订单 (上传凭证)
router.post('/submit', upload.single('evidence'), async (req, res) => {
  console.log('========================================');
  console.log('[Orders] 收到提交订单请求');
  
  try {
    const { orderId, userId, description } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    // 权限检查：只有订单创建者能提交
    if (order.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: '无权操作该订单' });
    }
    
    if (order.status !== 'Applied') {
      return res.status(400).json({ success: false, message: '当前状态不允许提交' });
    }

    // 处理图片路径
    let evidencePath = '';
    if (req.file) {
      evidencePath = `/uploads/${req.file.filename}`; // 保存相对路径
      console.log('[Orders] 凭证已保存:', evidencePath);
    }

    // 自动判断逻辑：如果资料完整，直接进入审批中，否则进入已提交
    let newStatus = 'Submitted';
    if (description && description.trim() !== '' && evidencePath) {
      newStatus = 'Reviewing';
      console.log('[Orders] 资料完整，自动进入 [审批中]');
    } else {
      console.log('[Orders] 资料不完整，保持 [已提交]');
    }

    order.description = description;
    order.evidence = evidencePath;
    order.status = newStatus;

    await order.save();
    console.log('[Orders] 订单更新成功:', order.orderNumber);

    res.json({ success: true, data: order, message: '提交成功' });
  } catch (err) {
    console.error('[Orders] 提交失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 取消订单
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    
    // 只能取消未提交的订单
    if (order.status !== 'Applied') {
      return res.status(400).json({ success: false, message: '只有未提交的订单可以取消' });
    }
    
    order.status = 'Cancelled';
    order.cancelledAt = new Date();
    await order.save();
    
    res.json({ success: true, message: '订单已取消' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// 3. 管理员接口
// ===============================

// 获取所有订单列表 (支持分页、搜索、筛选)
router.get('/admin', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status && status !== 'All') query.status = status;
    
    const orders = await Order.find(query)
      .populate('userId', 'email name')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
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

// 获取单个订单详情 (用于 Modal 展示图片和描述)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'email name')
      .populate('jobId', 'title');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 👇 核心：修改订单状态 (包含打款逻辑)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效的订单状态' });
    }

    // 必须关联 User 模型，才能操作余额
    const order = await Order.findById(orderId).populate('userId');
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });

    // 🛑 核心业务逻辑：如果是确认打款，给用户加钱
    if (status === 'Completed' && order.status !== 'Completed') {
      const amount = order.jobSnapshot.amount;
      console.log(`[Orders] 触发打款逻辑: 订单 ${orderId}, 金额 ¥${amount}`);
      
      try {
        // 调用 User 模型的 addBalance 方法
        await order.userId.addBalance(amount);
        order.completedAt = new Date();
        console.log(`[Orders] 打款成功，用户余额已更新`);
      } catch (balanceErr) {
        console.error('[Orders] 加款失败:', balanceErr);
        return res.status(500).json({ success: false, message: '加款失败: ' + balanceErr.message });
      }
    } else if (status === 'PendingPayment') {
      console.log(`[Orders] 订单审核通过，进入待打款阶段: ${orderId}`);
    }

    order.status = status;
    await order.save();

    // 返回更新后的订单（包含最新的用户余额）
    const updatedOrder = await Order.findById(orderId).populate('userId', 'email name balance');

    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    console.error('[Orders] 更新订单失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

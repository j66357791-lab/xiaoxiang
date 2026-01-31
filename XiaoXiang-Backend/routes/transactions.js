import express from 'express';
import Transaction from '../model/Transaction.js';
import Order from '../model/Order.js';

const router = express.Router();

// 获取当前用户的流水 (含分页)
router.get('/my', async (req, res) => {
  try {
    const { userId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .populate('orderId', 'orderNumber title') // 👈 关联订单号
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Transaction.countDocuments({ userId });

    res.json({
      success: true,
      data: transactions,
      pagination: { page: parseInt(page), total }
    });
  } catch (err) {
    console.error('[Transactions] 获取失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取用户统计数据 (今日/本月收益) - 用于个人中心下拉刷新
router.get('/stats', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: '缺少用户ID' });

    const User = req.app.get('User'); // 获取挂载到 app 的 Model
    const stats = await User.getStats(userId);
    
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 👇 管理员接口：获取所有交易流水 (佣金发放明细)
router.get('/admin/all', async (req, res) => {
  try {
    const { status = 'completed', page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ status })
      .populate('userId', 'email name') // 关联用户信息
      .populate('orderId', 'orderNumber') // 关联订单号
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({ status });

    res.json({
      success: true,
      data: transactions,
      pagination: { page: parseInt(page), total }
    });
  } catch (err) {
    console.error('[Transactions Admin] 获取失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

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

export default router;

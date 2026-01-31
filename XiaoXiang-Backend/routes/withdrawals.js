import express from 'express';
import Withdrawal from '../model/Withdrawal.js';
import User from '../model/User.js';
import PaymentMethod from '../model/PaymentMethod.js';

const router = express.Router();

// 用户：申请提现
router.post('/request', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, message: '参数错误' });

    // 1. 检查今日是否已提现该金额档位
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existing = await Withdrawal.findOne({
      userId,
      amount,
      status: { $in: ['Pending', 'Approved', 'Completed'] }, // 除去拒绝的
      requestTime: { $gte: startOfToday }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: '该金额档位今日已申请提现，请明日再试' });
    }

    // 2. 检查是否有已审核通过的收款方式
    const paymentMethods = await PaymentMethod.find({ userId, status: 'Approved' });
    if (paymentMethods.length === 0) {
      return res.status(400).json({ success: false, message: '请先绑定并通过审核的收款方式' });
    }

    // 3. 检查余额（此处假设选择第一个可用的收款方式）
    const user = await User.findById(userId);
    if (user.balance < amount) {
      return res.status(400).json({ success: false, message: '余额不足' });
    }

    // 4. 创建申请并扣除余额
    const newWithdrawal = new Withdrawal({
      userId,
      amount,
      paymentMethodId: paymentMethods[0]._id, // 简化逻辑：默认取第一个
      status: 'Pending'
    });

    user.balance -= amount;
    await user.save();
    await newWithdrawal.save();

    res.json({ success: true, message: '提现申请已提交，请等待审核' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 用户：获取提现记录
router.get('/my', async (req, res) => {
  const { userId } = req.query;
  const records = await Withdrawal.find({ userId }).sort({ createdAt: -1 }).populate('paymentMethodId');
  res.json({ success: true, data: records });
});

// 管理员：获取所有待审核提现
router.get('/admin', async (req, res) => {
  const records = await Withdrawal.find({ status: { $in: ['Pending', 'Approved'] } })
    .populate('userId', 'email name')
    .populate('paymentMethodId', 'type accountNo qrCode bankName')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: records });
});

// 管理员：审核提现 / 确认打款
router.patch('/admin/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body; // status: Approved (通过), Rejected (拒绝), Completed (已打款)

    const record = await Withdrawal.findById(id).populate('userId');
    if (!record) return res.status(404).json({ success: false, message: '记录不存在' });

    // 只有 Pending 状态才能变更为 Approved 或 Rejected
    if (record.status === 'Pending') {
      if (status === 'Rejected') {
        // 拒绝：退回余额
        record.status = 'Rejected';
        record.auditRemark = remark;
        record.auditTime = new Date();
        record.userId.balance += record.amount;
        await record.userId.save();
      } else if (status === 'Approved') {
        // 通过：待打款
        record.status = 'Approved';
        record.auditRemark = remark;
        record.auditTime = new Date();
      }
    } 
    // 只有 Approved 状态才能变更为 Completed (打款完成)
    else if (record.status === 'Approved' && status === 'Completed') {
      record.status = 'Completed';
      record.payoutTime = new Date();
    }

    await record.save();
    res.json({ success: true, message: '操作成功' });
  } catch (e) {
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

export default router;

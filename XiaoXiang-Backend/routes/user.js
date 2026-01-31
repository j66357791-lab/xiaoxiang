import express from 'express';
import User from '../model/User.js';
import PaymentMethod from '../model/PaymentMethod.js';

const router = express.Router();

// ===============================
// 用户端接口
// ===============================

// 1. 用户缴纳保证金
router.post('/deposit', async (req, res) => {
  console.log('[Route] POST /api/user/deposit');
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, message: '参数缺失' });

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return res.status(400).json({ success: false, message: '金额格式错误' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    user.deposit += val;
    await user.save();
    
    console.log(`[Deposit] User ${userId} deposit added: ${val}`);
    res.json({ success: true, message: '保证金缴纳成功', deposit: user.deposit });
  } catch (e) {
    console.error('[Deposit] Error:', e);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ===============================
// 管理员接口
// ===============================

// 2. 管理员获取用户详情 (含收款方式)
router.get('/admin/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    
    // 获取该用户的收款方式
    const paymentMethods = await PaymentMethod.find({ userId: id });
    
    res.json({ success: true, data: { ...user.toObject(), paymentMethods } });
  } catch (e) {
    console.error('[User Detail] Error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 3. 管理员实名审批
router.patch('/admin/user/:id/kyc', async (req, res) => {
  console.log('[Route] PATCH /api/user/admin/user/:id/kyc', req.params);
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Verified' or 'Rejected'
    
    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态无效' });
    }
    
    await User.findByIdAndUpdate(id, { kycStatus: status });
    console.log(`[KYC] User ${id} status changed to ${status}`);
    res.json({ success: true, message: '审核成功' });
  } catch (e) {
    console.error('[KYC] Audit Error:', e);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

export default router;

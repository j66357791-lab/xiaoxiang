import express from 'express';
import KycLog from '../model/KycLog.js';
import User from '../model/User.js';

const router = express.Router();

// 1. 用户：提交实名认证
router.post('/submit', async (req, res) => {
  console.log('[KYC] POST /api/kyc/submit');
  try {
    const { userId, idCard, front, back } = req.body; // front/back 为 base64 或相对路径，视前端上传方式而定
    
    if (!userId || !idCard || !front || !back) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    // 检查该身份证号是否已被其他账号绑定
    const existingLog = await KycLog.findOne({ idCard });
    if (existingLog) {
      // 如果是当前用户自己提交的（允许重试），或者其他人
      if (existingLog.userId.toString() !== userId) {
        return res.status(400).json({ success: false, message: '该身份证号已被其他账号绑定' });
      }
    }

    // 创建新的认证记录
    const newLog = new KycLog({
      userId,
      idCard,
      frontImage: front, // 假设前端传的是相对路径 /uploads/...
      backImage: back,
      status: 'Pending'
    });

    await newLog.save();

    // 更新用户状态为待审核
    await User.findByIdAndUpdate(userId, { kycStatus: 'Pending' });

    res.json({ success: true, message: '提交成功，等待审核' });

  } catch (e) {
    console.error('[KYC] Submit Error:', e);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 2. 用户：获取自己的认证历史记录
router.get('/my-logs', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: '缺少用户ID' });

    const logs = await KycLog.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 3. 管理员：获取认证列表（含筛选）
router.get('/admin/logs', async (req, res) => {
  try {
    const { status } = req.query; // Pending, Verified, Rejected, all
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    // 关联用户信息，方便管理员查看
    const logs = await KycLog.find(filter)
      .populate('userId', 'email name idCard')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 4. 管理员：审批实名认证
router.patch('/admin/approve/:logId', async (req, res) => {
  console.log('[KYC] Admin Approve:', req.params, req.body);
  try {
    const { logId } = req.params;
    const { status, rejectReason } = req.body; // 'Verified' or 'Rejected'

    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态无效' });
    }

    const log = await KycLog.findById(logId);
    if (!log) return res.status(404).json({ success: false, message: '记录不存在' });

    // 更新 Log 状态
    log.status = status;
    if (status === 'Rejected') log.rejectReason = rejectReason;
    if (status === 'Verified') {
      log.auditTime = new Date();
      // 如果审核通过，更新 User 表的认证状态和卡片信息（同步到 User）
      await User.findByIdAndUpdate(log.userId, {
        kycStatus: 'Verified',
        idCard: log.idCard,
        idCardFront: log.frontImage,
        idCardBack: log.backImage
      });
    }
    await log.save();

    res.json({ success: true, message: '审核完成' });

  } catch (e) {
    console.error('[KYC] Admin Error:', e);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

export default router;

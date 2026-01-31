import express from 'express';
import PaymentMethod from '../model/PaymentMethod.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 用户：提交绑定申请
router.post('/bind', upload.single('file'), async (req, res) => {
  try {
    const { userId, type, accountNo, bankName } = req.body;
    let qrCode = null;

    if (req.file) {
      qrCode = `/uploads/${req.file.filename}`;
    }

    if (type !== 'bank' && !accountNo && !qrCode) {
      return res.status(400).json({ success: false, message: '请填写账号或上传收款码' });
    }

    const newMethod = new PaymentMethod({
      userId,
      type,
      accountNo,
      bankName,
      qrCode,
      status: 'Pending'
    });

    await newMethod.save();
    res.json({ success: true, message: '申请已提交，等待审核' });
  } catch (e) {
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// 用户：获取我的收款方式
router.get('/my', async (req, res) => {
  const { userId } = req.query;
  const methods = await PaymentMethod.find({ userId }).sort({ createdAt: -1 });
  res.json({ success: true, data: methods });
});

// 管理员：获取待审核收款方式
router.get('/admin', async (req, res) => {
  const methods = await PaymentMethod.find({ status: 'Pending' })
    .populate('userId', 'email name')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: methods });
});

// 管理员：审核
router.patch('/admin/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;
    
    const method = await PaymentMethod.findById(id);
    if (!method) return res.status(404).json({ success: false, message: '记录不存在' });

    method.status = status; // Approved | Rejected
    method.auditRemark = remark;
    method.auditTime = new Date();
    await method.save();

    res.json({ success: true, message: '操作成功' });
  } catch (e) {
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

export default router;

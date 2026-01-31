import mongoose from 'mongoose';

const PaymentMethodSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['alipay', 'wechat', 'bank'], required: true },
  accountNo: { type: String }, // 支付宝/微信账号 或 银行卡号
  qrCode: { type: String }, // 二维码截图链接
  bankName: { type: String }, // 银行名称
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  auditRemark: { type: String },
  auditTime: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model('PaymentMethod', PaymentMethodSchema);

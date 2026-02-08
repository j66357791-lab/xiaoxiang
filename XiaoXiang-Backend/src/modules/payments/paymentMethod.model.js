import mongoose from 'mongoose';

const PaymentMethodSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['alipay', 'wechat', 'bank'], required: true },
  accountNo: { type: String },
  qrCode: { type: String },
  bankName: { type: String },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  auditRemark: { type: String },
  auditTime: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model('PaymentMethod', PaymentMethodSchema);

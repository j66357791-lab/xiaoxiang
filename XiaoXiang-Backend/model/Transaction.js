import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // 关联订单号
  type: { type: String, enum: ['income', 'withdraw', 'recharge'], required: true }, // 收入/提现/充值
  amount: { type: Number, required: true }, // 变动金额（正数）
  balanceSnapshot: { type: Number, required: true }, // 变动后的余额（用于校验）
  description: { type: String }, // 描述，如 "兼职任务佣金发放"
  status: { type: String, enum: ['completed', 'pending'], default: 'completed' }
}, {
  timestamps: true // 自动生成 createdAt (交易时间)
});

export default mongoose.model('Transaction', TransactionSchema);

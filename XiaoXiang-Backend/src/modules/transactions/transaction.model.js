import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  type: { 
    type: String, 
    enum: [
      // 原有类型
      'income', 'withdraw', 'recharge', 'commission',
      
      // 🆕 小象积分类型
      'points_income',      // 积分获得（游戏奖励、任务奖励等）
      'points_expense',     // 积分消费（游戏消费、兑换消耗等）
      
      // 🆕 小象币类型
      'coins_income',       // 小象币获得（充值、兑换获得等）
      'coins_expense',      // 小象币消费（消费、兑换消耗等）
      
      // 🆕 兑换类型
      'points_exchange',    // 积分兑换（积分→小象币）
      'coins_exchange',     // 小象币兑换（小象币→积分）
    ],
    required: true 
  },
  amount: { type: Number, required: true },
  balanceSnapshot: { type: Number, required: true },
  description: { type: String },
  status: { type: String, enum: ['completed', 'pending'], default: 'completed' }
}, {
  timestamps: true
});

// 🆕 添加索引以优化查询
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model('Transaction', TransactionSchema);

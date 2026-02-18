// src/modules/transactions/transaction.model.js
import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  gameId: { type: String }, // 游戏ID
  type: { 
    type: String, 
    enum: [
    // 原有类型
    'income', 'withdraw', 'recharge', 'commission',
    'points_income', 'points_expense',
    'coins_income', 'coins_expense',
    'points_exchange', 'coins_exchange',
    'gift_purchase',
    
    // 🎰 转盘游戏
    'wheel_ticket',
    'wheel_reward',
    'wheel_settle_fee',
    'wheel_jackpot',
    
    // 🃏 翻牌游戏
    'flipcard_ticket',
    'flipcard_reward',
    'flipcard_fee',
    
    // 🎁 神秘商店
    'mystery_shop_progress',
    'mystery_shop_reward',
    
    // 🐢 龟兔赛跑（新增）
    'race_bet',        // 下注
    'race_reward',     // 奖励
    ],
    required: true 
  },
  amount: { type: Number, required: true },
  balanceSnapshot: { type: Number },
  pointsSnapshot: { type: Number },
  coinsSnapshot: { type: Number },
  description: { type: String },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

// 添加索引以优化查询
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
TransactionSchema.index({ gameId: 1 });

export default mongoose.model('Transaction', TransactionSchema);

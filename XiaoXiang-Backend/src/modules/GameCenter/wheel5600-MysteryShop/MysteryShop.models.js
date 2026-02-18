// src/modules/wheel5600-MysteryShop/MysteryShop.models.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const MysteryShopLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // 抽奖场阶
  level: {
    type: String,
    enum: ['novice', 'elite', 'god'],
    required: true
  },
  // 消耗积分门槛
  threshold: {
    type: Number,
    required: true
  },
  // 抽奖前进度
  consumptionBefore: {
    type: Number,
    required: true
  },
  // 中奖结果
  reward: {
    type: {
      type: String,
      enum: ['jackpot_percent', 'points', 'coins', 'balance'],
      required: true
    },
    value: Number,
    description: String,
    percent: Number, // 如果是奖池百分比
  },
  // 实际发放金额（用于统计）
  actualAmount: {
    type: Number,
    default: 0
  },
  // 关联的交易记录
  transactionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  // 状态
  status: {
    type: String,
    enum: ['completed', 'failed'],
    default: 'completed'
  },
  // 抽奖时间
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
MysteryShopLogSchema.index({ userId: 1, createdAt: -1 });
MysteryShopLogSchema.index({ level: 1, createdAt: -1 });

const MysteryShopLog = mongoose.model('MysteryShopLog', MysteryShopLogSchema);

export default MysteryShopLog;

// src/modules/GameCenter/flipcard/FlipCard.models.js
import mongoose from 'mongoose';

const flipCardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  levelId: {
    type: String,
    default: 'easy'
  },
  levelName: {
    type: String,
    default: '初级场'
  },
  // 门票金额（玩家支付的积分）
  ticketPrice: {
    type: Number,
    required: true
  },
  // 倍率
  factor: {
    type: Number,
    default: 1.05
  },
  // 总卡片数
  totalCards: {
    type: Number,
    default: 16
  },
  // 兔子数量
  rabbitCount: {
    type: Number,
    default: 15
  },
  // 乌龟数量
  turtleCount: {
    type: Number,
    default: 1
  },
  // 卡片布局
  cards: [{
    type: { type: String, enum: ['rabbit', 'turtle'] },
    flipped: { type: Boolean, default: false }
  }],
  // 已翻开的卡片索引
  flippedCards: [{
    type: Number
  }],
  // 当前积分（可结算金额）
  currentScore: {
    type: Number,
    default: 0
  },
  // 已翻兔子数
  flippedRabbits: {
    type: Number,
    default: 0
  },
  // 游戏状态
  status: {
    type: String,
    enum: ['playing', 'won', 'lost', 'settled'],
    default: 'playing'
  },
  // 最终奖励（结算后）
  finalReward: {
    type: Number,
    default: 0
  },
  // 手续费
  fee: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('FlipCardGame', flipCardSchema);

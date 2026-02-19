// src/modules/gamescaiquan/gamescaiquan.model.js
import mongoose from 'mongoose';

const GuessFistGameSchema = new mongoose.Schema({
  // 创建者信息
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  creatorNickname: {
    type: String,
    default: '神秘玩家',
  },
  creatorHand: {
    type: String,
    enum: ['rock', 'paper', 'scissors'],
    required: true,
  },
  
  // 加入者信息
  joinerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  joinerNickname: {
    type: String,
    default: null,
  },
  joinerHand: {
    type: String,
    enum: ['rock', 'paper', 'scissors'],
    default: null,
  },
  
  // 游戏配置
  stake: {
    type: Number,
    required: true,
    min: [1, '赌注至少1积分'],
  },
  
  // 游戏状态
  status: {
    type: String,
    enum: ['waiting', 'completed', 'cancelled'],
    default: 'waiting',
  },
  
  // 结果
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  winAmount: {
    type: Number,
    default: 0,
  },
  
  // 时间
  completedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// 索引
GuessFistGameSchema.index({ status: 1, createdAt: -1 });
GuessFistGameSchema.index({ creatorId: 1 });
GuessFistGameSchema.index({ joinerId: 1 });

export default mongoose.model('GuessFistGame', GuessFistGameSchema);

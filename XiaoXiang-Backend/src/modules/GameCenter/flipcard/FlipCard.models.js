import mongoose from 'mongoose';

const FlipCardGameSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  levelId: { type: String, required: true },
  betAmount: { type: Number, required: true },
  cards: [{ type: String, enum: ['rabbit', 'turtle'] }], // 服务端存储的牌组
  revealedIndices: [Number], // 已翻开的卡片索引
  currentScore: { type: Number, default: 0 },
  flippedRabbits: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'settled', 'lost'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('FlipCardGame', FlipCardGameSchema);

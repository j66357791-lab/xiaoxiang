// src/modules/GameCenter/guitusaipao/RaceGame.models.js
import mongoose from 'mongoose';

// 比赛记录
const raceSchema = new mongoose.Schema({
  raceId: { type: String, required: true, unique: true },
  raceNumber: { type: Number, required: true },
  status: { type: String, enum: ['betting', 'racing', 'settled'], default: 'betting' },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  
  result: {
    winner: { type: String, enum: ['turtle', 'rabbit'] },
    turtlePosition: { type: Number, default: 0 },
    rabbitPosition: { type: Number, default: 0 },
  },
  
  events: [{
    eventId: String,
    name: String,
    target: String,
    multiplier: Number,
    triggeredAt: Number,
    duration: Number,
  }],
  
  animationFrames: [{ time: Number, turtle: Number, rabbit: Number }],
  
  bettingStats: {
    totalBets: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    turtleBets: { type: Number, default: 0 },
    turtleAmount: { type: Number, default: 0 },
    rabbitBets: { type: Number, default: 0 },
    rabbitAmount: { type: Number, default: 0 },
  },
  
  settlementStats: {
    totalWinners: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },
    totalBet: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
  }
}, { timestamps: true });

// 下注记录
const betSchema = new mongoose.Schema({
  raceId: { type: String, required: true, index: true },
  raceNumber: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  side: { type: String, enum: ['turtle', 'rabbit'], required: true },
  amount: { type: Number, required: true },
  isWin: { type: Boolean, default: false },
  winAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'settled', 'cancelled'], default: 'pending' },
  betAt: { type: Date, default: Date.now }
}, { timestamps: true });

betSchema.index({ raceId: 1, userId: 1 }, { unique: true });

export const Race = mongoose.model('RaceGame', raceSchema);
export const Bet = mongoose.model('RaceBet', betSchema);

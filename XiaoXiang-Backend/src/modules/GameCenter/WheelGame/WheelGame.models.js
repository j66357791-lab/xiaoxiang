// src/WheelGame/WheelGame.models.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const WheelGameSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  gameId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'died', 'settled'], 
    default: 'active' 
  },
  ticketPrice: { 
    type: Number, 
    default: 10 
  },
  currentPoints: { 
    type: Number, 
    default: 10 
  },
  currentRound: { 
    type: Number, 
    default: 0 
  },
  spinHistory: [{
    round: Number,
    sectorIndex: Number,
    sectorType: String,
    sectorValue: Number,
    pointsBefore: Number,
    pointsAfter: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  result: {
    type: { type: String },
    finalPoints: Number,
    feePaid: Number,
    jackpotWon: Number,
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  serverSeed: String,
  nonce: { type: Number, default: 0 }
});

// 添加索引
WheelGameSchema.index({ userId: 1, status: 1 });
WheelGameSchema.index({ startedAt: -1 });

const WheelGame = mongoose.model('WheelGame', WheelGameSchema);

export default WheelGame;

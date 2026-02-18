// src/WheelGame/Jackpot.models.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const JackpotSchema = new Schema({
  gameType: { 
    type: String, 
    default: 'wheel5600', 
    unique: true 
  },
  amount: { 
    type: Number, 
    default: 0 
  },
  totalGames: { 
    type: Number, 
    default: 0 
  },
  totalWins: { 
    type: Number, 
    default: 0 
  },
  lastWinAmount: Number,
  lastWinUserId: Schema.Types.ObjectId,
  lastWinAt: Date,
  updatedAt: { type: Date, default: Date.now }
});

const Jackpot = mongoose.model('Jackpot', JackpotSchema);

export default Jackpot;

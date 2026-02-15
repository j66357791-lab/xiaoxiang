import mongoose from 'mongoose';

const StockLogSchema = new mongoose.Schema({
  module: { type: String, required: true }, 
  action: { type: String, required: true }, 
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetName: { type: String },
  
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    diff: mongoose.Schema.Types.Mixed,
  },
  
  reason: { type: String },
  
  operator: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    role: { type: String }
  },
}, { timestamps: true });

StockLogSchema.index({ createdAt: -1 });

export default mongoose.model('StockLog', StockLogSchema);

import mongoose from 'mongoose';

const StockLogSchema = new mongoose.Schema({
  // 模块
  module: { 
    type: String, 
    enum: ['stock', 'order', 'recycle_task'], 
    required: true 
  },
  
  // 操作类型
  action: { 
    type: String, 
    required: true 
  },
  
  // 目标
  targetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  targetName: { type: String },
  
  // 变更内容
  changes: {
    before: { type: Number },
    after: { type: Number },
    diff: { type: Number }
  },
  
  // 原因
  reason: { type: String },
  
  // 操作人
  operator: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    role: { type: String }
  }
  
}, { timestamps: true });

// 索引
StockLogSchema.index({ module: 1, action: 1 });
StockLogSchema.index({ targetId: 1 });

export default mongoose.model('StockLog', StockLogSchema);

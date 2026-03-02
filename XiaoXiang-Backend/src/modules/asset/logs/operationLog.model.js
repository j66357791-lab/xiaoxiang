// src/modules/logs/operationLog.model.js
import mongoose from 'mongoose';

const OperationLogSchema = new mongoose.Schema({
  operator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  operatorEmail: { 
    type: String, 
    required: true 
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      '同步数据',
      '搁置',
      '取消搁置',
      '处置订单',
      '更新状态',
      '回退订单',
      '删除资产',
      '编辑资产',
      '批量录入',
      '其他'
    ]
  },
  targetType: { 
    type: String, 
    enum: ['Order', 'Asset', 'System', 'Batch'],
    default: 'Asset'
  },
  targetId: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  targetNumber: { 
    type: String 
  },
  details: { 
    type: String,
    default: ''
  },
  metadata: {
    before: { type: Object },
    after: { type: Object },
    extra: { type: Object }
  },
  ipAddress: { type: String },
  userAgent: { type: String }
}, {
  timestamps: true
});

// 索引
OperationLogSchema.index({ createdAt: -1 });
OperationLogSchema.index({ operator: 1 });
OperationLogSchema.index({ action: 1 });

// 🔥 关键修复：防止重复编译
const OperationLog = mongoose.models.OperationLog || mongoose.model('OperationLog', OperationLogSchema);

export default OperationLog;

// src/modules/logs/operationLog.model.js
import mongoose from 'mongoose';

/**
 * 操作日志模型
 * 用于记录资产中心的所有操作行为
 */
const OperationLogSchema = new mongoose.Schema({
  // 操作人
  operator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  operatorEmail: { 
    type: String, 
    required: true 
  }, // 冗余存储，避免联表
  
  // 操作类型
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
  
  // 关联目标
  targetType: { 
    type: String, 
    enum: ['Order', 'Asset', 'System', 'Batch'],
    default: 'Asset'
  },
  targetId: { 
    type: mongoose.Schema.Types.ObjectId 
  }, // 关联的订单ID或资产ID
  targetNumber: { 
    type: String 
  }, // 订单号或资产编号 (冗余存储)
  
  // 操作详情
  details: { 
    type: String,
    default: ''
  },
  
  // 扩展元数据
  metadata: {
    before: { type: Object }, // 操作前状态
    after: { type: Object },  // 操作后状态
    extra: { type: Object }   // 其他信息
  },
  
  // 客户端信息
  ipAddress: { type: String },
  userAgent: { type: String }
}, {
  timestamps: true
});

// 索引优化
OperationLogSchema.index({ createdAt: -1 });
OperationLogSchema.index({ operator: 1 });
OperationLogSchema.index({ action: 1 });
OperationLogSchema.index({ targetId: 1 });

const OperationLog = mongoose.model('OperationLog', OperationLogSchema);
export default OperationLog;

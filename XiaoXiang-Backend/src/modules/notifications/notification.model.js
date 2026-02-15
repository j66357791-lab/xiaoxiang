import mongoose from 'mongoose';

/**
 * 通知数据模型
 * 用于存储用户的通知记录
 */
const NotificationSchema = new mongoose.Schema({
  // 接收通知的用户
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // 通知标题
  title: {
    type: String,
    required: true
  },
  
  // 通知内容
  body: {
    type: String,
    required: true
  },
  
  // 通知类型
  type: {
    type: String,
    enum: ['order', 'message', 'system', 'announcement', 'withdrawal'],
    default: 'system'
  },
  
  // 额外数据（用于点击通知后跳转）
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // 是否已读
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // 推送状态
  pushStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  
  // 推送错误信息
  pushError: {
    type: String
  }
}, {
  timestamps: true
});

// 复合索引：用户 + 创建时间（用于列表查询）
NotificationSchema.index({ userId: 1, createdAt: -1 });

// 复合索引：用户 + 是否已读（用于未读计数）
NotificationSchema.index({ userId: 1, isRead: 1 });

export default mongoose.model('Notification', NotificationSchema);

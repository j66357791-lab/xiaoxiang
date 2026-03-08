// src/modules/help-people/help-people.model.js
// 客服工单数据模型

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ==================== 工单/会话模型 ====================
const ticketSchema = new Schema({
  // 工单ID
  ticketId: {
    type: String,
    required: true,
    unique: true,
    default: () => `TK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  },
  
  // 用户信息
  userId: {
    type: String,
    required: true,
    index: true
  },
  userInfo: {
    nickname: { type: String, default: '用户' },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  
  // 工单状态
  // ai_chatting: AI接待中
  // pending: 待人工处理（用户已要求转人工）
  // in_progress: 客服处理中
  // resolved: 已解决
  // closed: 已关闭
  status: {
    type: String,
    enum: ['ai_chatting', 'pending', 'in_progress', 'resolved', 'closed'],
    default: 'ai_chatting'
  },
  
  // 工单分类
  category: {
    type: String,
    enum: ['task', 'withdraw', 'account', 'audit', 'other'],
    default: 'other'
  },
  
  // 工单标题/主题（自动从首条消息生成）
  title: {
    type: String,
    default: ''
  },
  
  // 是否已转人工
  isTransferredToHuman: {
    type: Boolean,
    default: false
  },
  transferredAt: {
    type: Date
  },
  
  // 分配的客服信息
  assignedTo: {
    serviceId: { type: String, default: null },
    serviceInfo: {
      nickname: { type: String, default: '' },
      avatar: { type: String, default: '' }
    },
    assignedAt: { type: Date }
  },
  
  // 最后一条消息预览
  lastMessage: {
    content: { type: String, default: '' },
    senderType: { type: String, enum: ['user', 'service', 'ai', 'system'] },
    createdAt: { type: Date, default: Date.now }
  },
  
  // 未读消息数
  unreadCount: {
    user: { type: Number, default: 0 },
    service: { type: Number, default: 0 }
  },
  
  // 评价信息
  rating: {
    score: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    ratedAt: { type: Date }
  },
  
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'help_tickets'
});

// ==================== 消息模型 ====================
const messageSchema = new Schema({
  // 消息ID
  messageId: {
    type: String,
    required: true,
    unique: true,
    default: () => `MSG${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  },
  
  // 所属工单
  ticketId: {
    type: String,
    required: true,
    index: true
  },
  
  // 发送者信息
  senderId: {
    type: String,
    required: true
  },
  // user: 用户
  // ai: AI客服
  // service: 人工客服
  // system: 系统消息
  senderType: {
    type: String,
    enum: ['user', 'service', 'ai', 'system'],
    required: true
  },
  senderInfo: {
    nickname: { type: String, default: '' },
    avatar: { type: String, default: '' }
  },
  
  // 消息内容
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  content: {
    type: String,
    required: true
  },
  
  // 附件信息
  attachment: {
    url: { type: String },
    fileName: { type: String },
    fileSize: { type: Number }
  },
  
  // 消息状态
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'help_messages'
});

// ==================== FAQ 模型 ====================
const faqSchema = new Schema({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['task', 'withdraw', 'account', 'audit', 'other'],
    default: 'other'
  },
  // 关键词用于匹配
  keywords: [{
    type: String
  }],
  // 排序权重
  sortOrder: {
    type: Number,
    default: 0
  },
  // 是否启用
  isActive: {
    type: Boolean,
    default: true
  },
  // 统计
  viewCount: {
    type: Number,
    default: 0
  },
  matchCount: {
    type: Number,
    default: 0
  },
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'help_faqs'
});

// ==================== 客服人员模型 ====================
const serviceStaffSchema = new Schema({
  serviceId: {
    type: String,
    required: true,
    unique: true
  },
  nickname: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: ''
  },
  // 在线状态
  status: {
    type: String,
    enum: ['online', 'offline', 'busy'],
    default: 'offline'
  },
  // 当前处理的工单数
  activeTickets: {
    type: Number,
    default: 0
  },
  // 统计
  totalResolved: {
    type: Number,
    default: 0
  },
  avgRating: {
    type: Number,
    default: 0
  },
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'help_service_staff'
});

// ==================== 索引 ====================
ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ status: 1, updatedAt: -1 });
ticketSchema.index({ 'assignedTo.serviceId': 1, status: 1 });

messageSchema.index({ ticketId: 1, createdAt: 1 });

faqSchema.index({ category: 1, sortOrder: 1 });
faqSchema.index({ keywords: 1 });
faqSchema.index({ isActive: 1 });

serviceStaffSchema.index({ status: 1 });

// ==================== 导出模型 ====================
export const Ticket = mongoose.model('HelpTicket', ticketSchema);
export const Message = mongoose.model('HelpMessage', messageSchema);
export const FAQ = mongoose.model('HelpFAQ', faqSchema);
export const ServiceStaff = mongoose.model('HelpServiceStaff', serviceStaffSchema);

export default {
  Ticket,
  Message,
  FAQ,
  ServiceStaff
};

// src/modules/help-people/help-people.model.js
// 客服工单数据模型 - 优化版

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ==================== 客服人员模型 ====================
const serviceStaffSchema = new Schema({
  // 客服ID（001, 002, 003...）
  serviceId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // 客服昵称
  nickname: {
    type: String,
    required: true,
    default: '小象客服',
  },
  
  // 头像
  avatar: {
    type: String,
    default: '',
  },
  
  // 角色类型
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'service'],
    default: 'service',
  },
  
  // 在线状态
  onlineStatus: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'offline',
  },
  
  // 是否挂起接单（自动接单模式）
  isAutoAssign: {
    type: Boolean,
    default: false,
  },
  
  // 最后在线时间
  lastOnlineAt: {
    type: Date,
    default: null,
  },
  
  // 当前处理的工单ID列表
  activeTicketIds: [{
    type: String,
  }],
  
  // 最大同时处理工单数
  maxActiveTickets: {
    type: Number,
    default: 10,
  },
  
  // 统计数据
  stats: {
    totalResolved: { type: Number, default: 0 },
    todayResolved: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
  },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'help_service_staff',
  timestamps: true,
});

// ==================== 工单模型 ====================
const ticketSchema = new Schema({
  // 工单ID
  ticketId: {
    type: String,
    required: true,
    unique: true,
    default: () => `TK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
  },
  
  // 用户信息
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userInfo: {
    nickname: { type: String, default: '用户' },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  
  // 工单状态
  status: {
    type: String,
    enum: ['ai_chatting', 'pending', 'in_progress', 'waiting_user', 'resolved', 'closed'],
    default: 'ai_chatting',
  },
  
  // 工单分类
  category: {
    type: String,
    enum: ['task', 'withdraw', 'account', 'audit', 'other'],
    default: 'other',
  },
  
  // 工单标题/主题
  title: {
    type: String,
    default: '',
  },
  
  // 是否已转人工
  isTransferredToHuman: {
    type: Boolean,
    default: false,
  },
  transferredAt: {
    type: Date,
  },
  
  // 分配的客服信息
  assignedTo: {
    serviceId: { type: String, default: null },
    serviceInfo: {
      nickname: { type: String, default: '' },
      avatar: { type: String, default: '' },
      serviceNumber: { type: String, default: '' },
    },
    assignedAt: { type: Date },
  },
  
  // 最后一条消息预览
  lastMessage: {
    content: { type: String, default: '' },
    senderType: { type: String, enum: ['user', 'service', 'ai', 'system'] },
    createdAt: { type: Date, default: Date.now },
  },
  
  // 未读消息数
  unreadCount: {
    user: { type: Number, default: 0 },
    service: { type: Number, default: 0 },
  },
  
  // 用户最后活跃时间
  userLastActiveAt: {
    type: Date,
    default: Date.now,
  },
  
  // 客服最后回复时间
  serviceLastReplyAt: {
    type: Date,
  },
  
  // 是否需要客服回复
  needServiceReply: {
    type: Boolean,
    default: false,
  },
  
  // 评价信息
  rating: {
    score: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    ratedAt: { type: Date },
  },
  
  // 优先级
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
  firstResponseAt: { type: Date },
}, {
  timestamps: true,
  collection: 'help_tickets',
});

// ==================== 消息模型 ====================
const messageSchema = new Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    default: () => `MSG${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
  },
  
  ticketId: {
    type: String,
    required: true,
    index: true,
  },
  
  senderId: { type: String, required: true },
  senderType: {
    type: String,
    enum: ['user', 'service', 'ai', 'system'],
    required: true,
  },
  senderInfo: {
    nickname: { type: String, default: '' },
    avatar: { type: String, default: '' },
    serviceNumber: { type: String },
  },
  
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text',
  },
  content: { type: String, required: true },
  
  attachment: {
    url: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
  },
  
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
  collection: 'help_messages',
});

// ==================== FAQ 模型 ====================
const faqSchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: {
    type: String,
    enum: ['task', 'withdraw', 'account', 'audit', 'other'],
    default: 'other',
  },
  keywords: [{ type: String }],
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  viewCount: { type: Number, default: 0 },
  matchCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'help_faqs',
});

// ==================== 快捷回复模板 ====================
const quickReplySchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'common' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
}, {
  collection: 'help_quick_replies',
});

// ==================== 索引 ====================
ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ status: 1, updatedAt: -1 });
ticketSchema.index({ 'assignedTo.serviceId': 1, status: 1 });
ticketSchema.index({ needServiceReply: 1, status: 1 });

messageSchema.index({ ticketId: 1, createdAt: 1 });

faqSchema.index({ category: 1, sortOrder: 1 });
faqSchema.index({ keywords: 1 });

serviceStaffSchema.index({ onlineStatus: 1 });
serviceStaffSchema.index({ isAutoAssign: 1, onlineStatus: 1 });

// ==================== 导出模型 ====================
export const ServiceStaff = mongoose.model('HelpServiceStaff', serviceStaffSchema);
export const Ticket = mongoose.model('HelpTicket', ticketSchema);
export const Message = mongoose.model('HelpMessage', messageSchema);
export const FAQ = mongoose.model('HelpFAQ', faqSchema);
export const QuickReply = mongoose.model('HelpQuickReply', quickReplySchema);

export default {
  ServiceStaff,
  Ticket,
  Message,
  FAQ,
  QuickReply,
};

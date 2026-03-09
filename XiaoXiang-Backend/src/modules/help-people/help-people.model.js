// src/modules/help-people/help-people.model.js
// 客服工单数据模型 - 规范版（参考美团/淘宝客服系统）

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ==================== FAQ分类模型（主FAQ） ====================
const faqCategorySchema = new Schema({
  // 分类ID
  categoryId: {
    type: String,
    required: true,
    unique: true,
    default: () => `CAT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
  },
  
  // 分类名称
  name: {
    type: String,
    required: true,
  },
  
  // 分类图标
  icon: {
    type: String,
    default: 'question-circle',
  },
  
  // 分类颜色
  color: {
    type: String,
    default: '#1890ff',
  },
  
  // 排序权重
  sortOrder: {
    type: Number,
    default: 0,
  },
  
  // 是否启用
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // 关联的次流程数量
  flowCount: {
    type: Number,
    default: 0,
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'help_faq_categories',
  timestamps: true,
});

// ==================== FAQ次流程模型 ====================
const faqFlowSchema = new Schema({
  // 流程ID
  flowId: {
    type: String,
    required: true,
    unique: true,
    default: () => `FLOW${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
  },
  
  // 所属主分类
  categoryId: {
    type: String,
    required: true,
    index: true,
  },
  
  // 流程标题（问题）
  title: {
    type: String,
    required: true,
  },
  
  // 流程描述
  description: {
    type: String,
    default: '',
  },
  
  // 话术模板（客服回复内容）
  script: {
    type: String,
    required: true,
  },
  
  // 关键词（用于AI匹配）
  keywords: [{
    type: String,
  }],
  
  // 是否需要创建工单
  needTicket: {
    type: Boolean,
    default: false,
  },
  
  // 工单类型（如果需要创建工单）
  ticketType: {
    type: String,
    enum: ['consultation', 'complaint', 'refund', 'account', 'task', 'withdraw', 'other'],
    default: 'consultation',
  },
  
  // 排序权重
  sortOrder: {
    type: Number,
    default: 0,
  },
  
  // 是否启用
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // 使用次数
  useCount: {
    type: Number,
    default: 0,
  },
  
  // 匹配次数（AI匹配）
  matchCount: {
    type: Number,
    default: 0,
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'help_faq_flows',
  timestamps: true,
});

// ==================== 客服人员模型 ====================
const serviceStaffSchema = new Schema({
  serviceId: {
    type: String,
    required: true,
    unique: true,
  },
  
  nickname: {
    type: String,
    required: true,
    default: '小象客服',
  },
  
  avatar: {
    type: String,
    default: '',
  },
  
  // 角色类型
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'service', 'leader'],
    default: 'service',
  },
  
  // 所属客服组
  groupId: {
    type: String,
    default: 'default',
  },
  
  // 在线状态
  onlineStatus: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'offline',
  },
  
  // 是否自动接单
  isAutoAssign: {
    type: Boolean,
    default: false,
  },
  
  // 最大同时处理工单数
  maxActiveTickets: {
    type: Number,
    default: 10,
  },
  
  // 当前处理的工单ID列表
  activeTicketIds: [{
    type: String,
  }],
  
  // 统计数据
  stats: {
    totalResolved: { type: Number, default: 0 },
    todayResolved: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    totalChats: { type: Number, default: 0 },
    todayChats: { type: Number, default: 0 },
  },
  
  lastOnlineAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'help_service_staff',
  timestamps: true,
});

// ==================== 工单模型 ====================
const ticketSchema = new Schema({
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
    enum: ['ai_chatting', 'queuing', 'pending', 'in_progress', 'waiting_user', 'resolved', 'closed'],
    default: 'ai_chatting',
  },
  
  // 工单分类
  category: {
    type: String,
    enum: ['task', 'withdraw', 'account', 'audit', 'other'],
    default: 'other',
  },
  
  // 问题类型
  issueType: {
    type: String,
    enum: ['consultation', 'complaint', 'refund', 'account', 'task', 'withdraw', 'other'],
    default: 'consultation',
  },
  
  // 工单标题
  title: {
    type: String,
    default: '',
  },
  
  // 优先级
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  
  // 来源渠道
  source: {
    type: String,
    enum: ['app', 'web', 'admin'],
    default: 'app',
  },
  
  // 分配信息
  assignedTo: {
    serviceId: { type: String, default: null },
    serviceInfo: {
      nickname: { type: String, default: '' },
      avatar: { type: String, default: '' },
      serviceNumber: { type: String, default: '' },
    },
    assignedAt: { type: Date },
    groupId: { type: String, default: 'default' },
  },
  
  // 转接信息
  transferInfo: {
    fromServiceId: { type: String },
    fromServiceName: { type: String },
    toServiceId: { type: String },
    toServiceName: { type: String },
    transferReason: { type: String },
    transferredAt: { type: Date },
  },
  
  // 最后消息预览
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
  
  // 是否需要客服回复
  needServiceReply: {
    type: Boolean,
    default: false,
  },
  
  // 用户需求描述
  userRequirement: {
    type: String,
    default: '',
  },
  
  // 解决方案
  solution: {
    type: String,
    default: '',
  },
  
  // 完结信息
  closeInfo: {
    closeType: { 
      type: String, 
      enum: ['resolved', 'unresolved', 'user_cancel', 'timeout', 'other'],
      default: 'resolved'
    },
    closeReason: { type: String, default: '' },
    satisfaction: { type: Number, default: 5, min: 1, max: 5 },
    remark: { type: String, default: '' },
    closedAt: { type: Date },
  },
  
  // 处理日志
  processLogs: [{
    time: { type: Date, default: Date.now },
    operatorId: { type: String, default: '' },
    operatorName: { type: String, default: '' },
    action: { type: String, default: '' },
    content: { type: String, default: '' },
  }],
  
  // 评价信息
  rating: {
    score: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    ratedAt: { type: Date },
  },
  
  // 时间戳
  userLastActiveAt: { type: Date, default: Date.now },
  serviceLastReplyAt: { type: Date },
  firstResponseAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
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
    enum: ['text', 'image', 'file', 'system', 'faq'],
    default: 'text',
  },
  content: { type: String, required: true },
  
  // FAQ来源（如果是FAQ回复）
  faqSource: {
    flowId: { type: String },
    categoryId: { type: String },
    flowTitle: { type: String },
  },
  
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

// ==================== 客服组模型 ====================
const serviceGroupSchema = new Schema({
  groupId: {
    type: String,
    required: true,
    unique: true,
  },
  
  name: {
    type: String,
    required: true,
  },
  
  description: {
    type: String,
    default: '',
  },
  
  // 组长
  leaderId: {
    type: String,
    default: '',
  },
  
  // 组员
  members: [{
    type: String,
  }],
  
  // 排班配置
  schedule: {
    workDays: [{ type: Number }], // 0-6
    workHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'help_service_groups',
  timestamps: true,
});

// ==================== 服务历史模型 ====================
const serviceHistorySchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  
  ticketId: {
    type: String,
    required: true,
    index: true,
  },
  
  issueType: {
    type: String,
    default: '咨询问题',
  },
  
  progress: {
    type: String,
    default: '处理中',
  },
  
  serviceInfo: {
    serviceId: { type: String },
    nickname: { type: String },
    serviceNumber: { type: String },
  },
  
  description: {
    type: String,
    default: '',
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'help_service_history',
  timestamps: true,
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
ticketSchema.index({ priority: 1, createdAt: 1 });

messageSchema.index({ ticketId: 1, createdAt: 1 });

faqCategorySchema.index({ sortOrder: 1 });
faqFlowSchema.index({ categoryId: 1, sortOrder: 1 });
faqFlowSchema.index({ keywords: 1 });

serviceStaffSchema.index({ onlineStatus: 1 });
serviceStaffSchema.index({ groupId: 1 });

serviceHistorySchema.index({ userId: 1, createdAt: -1 });

// ==================== 导出模型 ====================
const FAQCategory = mongoose.model('HelpFAQCategory', faqCategorySchema);
const FAQFlow = mongoose.model('HelpFAQFlow', faqFlowSchema);
const ServiceStaff = mongoose.model('HelpServiceStaff', serviceStaffSchema);
const Ticket = mongoose.model('HelpTicket', ticketSchema);
const Message = mongoose.model('HelpMessage', messageSchema);
const ServiceGroup = mongoose.model('HelpServiceGroup', serviceGroupSchema);
const ServiceHistory = mongoose.model('HelpServiceHistory', serviceHistorySchema);
const QuickReply = mongoose.model('HelpQuickReply', quickReplySchema);

const models = {
  FAQCategory,
  FAQFlow,
  ServiceStaff,
  Ticket,
  Message,
  ServiceGroup,
  ServiceHistory,
  QuickReply,
};

export default models;
export { 
  FAQCategory, 
  FAQFlow, 
  ServiceStaff, 
  Ticket, 
  Message, 
  ServiceGroup, 
  ServiceHistory, 
  QuickReply 
};

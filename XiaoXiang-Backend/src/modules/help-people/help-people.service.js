// src/modules/help-people/help-people.service.js
// 客服服务层 - 优化版（支持客服分流、自动接单）

import ZAI from 'z-ai-web-dev-sdk';
import { Ticket, Message, FAQ, ServiceStaff, QuickReply } from './help-people.model.js';

// AI 服务实例
let zaiInstance = null;

async function initAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// 转人工关键词
const TRANSFER_KEYWORDS = [
  '转人工', '人工客服', '人工服务', '转接人工',
  '找人工', '人工', '真人', '真人客服',
  '不想和机器人', '不想和ai', '客服人员',
  '转客服', '接人工', '人工回复'
];

// ==================== 客服管理服务 ====================

/**
 * 初始化超级管理员客服（001号）
 */
export async function initSuperAdmin() {
  const existing = await ServiceStaff.findOne({ serviceId: '001' });
  
  if (!existing) {
    await ServiceStaff.create({
      serviceId: '001',
      nickname: '小象客服',
      role: 'super_admin',
      onlineStatus: 'offline',
      isAutoAssign: false,
    });
    console.log('[客服系统] ✅ 已初始化超级管理员客服 001');
  }
  
  return existing || await ServiceStaff.findOne({ serviceId: '001' });
}

/**
 * 客服上线
 */
export async function serviceOnline(serviceId) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  // 更新在线状态
  await ServiceStaff.updateOne(
    { serviceId },
    {
      onlineStatus: 'online',
      lastOnlineAt: new Date(),
      updatedAt: new Date(),
    }
  );
  
  // 如果开启了自动接单，自动接起待处理工单
  if (staff.isAutoAssign) {
    const assignedCount = await autoAssignPendingTickets(serviceId);
    console.log(`[客服上线] 自动接起 ${assignedCount} 个待处理工单`);
  }
  
  return await ServiceStaff.findOne({ serviceId });
}

/**
 * 客服下线
 */
export async function serviceOffline(serviceId) {
  await ServiceStaff.updateOne(
    { serviceId },
    {
      onlineStatus: 'offline',
      updatedAt: new Date(),
    }
  );
  
  return await ServiceStaff.findOne({ serviceId });
}

/**
 * 切换自动接单模式
 */
export async function toggleAutoAssign(serviceId, isAutoAssign) {
  const staff = await ServiceStaff.findOneAndUpdate(
    { serviceId },
    {
      isAutoAssign,
      updatedAt: new Date(),
    },
    { new: true }
  );
  
  // 如果开启自动接单且在线，立即接起待处理工单
  if (isAutoAssign && staff.onlineStatus === 'online') {
    const assignedCount = await autoAssignPendingTickets(serviceId);
    console.log(`[自动接单] 接起 ${assignedCount} 个待处理工单`);
  }
  
  return staff;
}

/**
 * 自动接起待处理工单
 */
async function autoAssignPendingTickets(serviceId) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff || staff.onlineStatus !== 'online') {
    return 0;
  }
  
  // 查找待处理工单（pending状态，且未被分配）
  const pendingTickets = await Ticket.find({
    status: 'pending',
    'assignedTo.serviceId': null,
  }).sort({ createdAt: 1 });
  
  let assignedCount = 0;
  
  for (const ticket of pendingTickets) {
    // 检查是否超过最大处理数
    if (staff.activeTicketIds.length >= staff.maxActiveTickets) {
      break;
    }
    
    // 分配工单
    await assignTicketToService(ticket.ticketId, serviceId, false);
    assignedCount++;
  }
  
  return assignedCount;
}

/**
 * 分配工单给客服
 */
async function assignTicketToService(ticketId, serviceId, sendWelcome = true) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  // 更新工单
  await Ticket.updateOne(
    { ticketId },
    {
      status: 'in_progress',
      'assignedTo.serviceId': serviceId,
      'assignedTo.serviceInfo': {
        nickname: staff.nickname,
        avatar: staff.avatar,
        serviceNumber: staff.serviceId,
      },
      'assignedTo.assignedAt': new Date(),
      updatedAt: new Date(),
    }
  );
  
  // 更新客服的活跃工单列表
  await ServiceStaff.updateOne(
    { serviceId },
    {
      $addToSet: { activeTicketIds: ticketId },
      updatedAt: new Date(),
    }
  );
  
  // 发送欢迎消息
  if (sendWelcome) {
    await Message.create({
      ticketId,
      senderId: serviceId,
      senderType: 'service',
      senderInfo: {
        nickname: staff.nickname,
        avatar: staff.avatar,
        serviceNumber: staff.serviceId,
      },
      content: `${staff.serviceId}号${staff.nickname}很高兴为您服务，亲亲有什么可以帮您的吗？`,
    });
  }
  
  return true;
}

/**
 * 获取客服工作台数据
 */
export async function getServiceWorkbench(serviceId) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  // 获取各状态工单数量
  const [pendingCount, inProgressCount, waitingUserCount, resolvedCount] = await Promise.all([
    Ticket.countDocuments({ status: 'pending' }),
    Ticket.countDocuments({ 'assignedTo.serviceId': serviceId, status: 'in_progress' }),
    Ticket.countDocuments({ 'assignedTo.serviceId': serviceId, status: 'waiting_user' }),
    Ticket.countDocuments({ 'assignedTo.serviceId': serviceId, status: 'resolved' }),
  ]);
  
  // 获取待处理工单列表
  const pendingTickets = await Ticket.find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();
  
  // 获取我的工单列表
  const myTickets = await Ticket.find({
    'assignedTo.serviceId': serviceId,
    status: { $in: ['in_progress', 'waiting_user'] },
  })
    .sort({ needServiceReply: -1, updatedAt: -1 })
    .lean();
  
  return {
    staffInfo: staff,
    stats: {
      pending: pendingCount,
      inProgress: inProgressCount,
      waitingUser: waitingUserCount,
      resolved: resolvedCount,
    },
    pendingTickets,
    myTickets,
  };
}

/**
 * 获取需要回复的工单列表
 */
export async function getNeedReplyTickets(serviceId) {
  const tickets = await Ticket.find({
    'assignedTo.serviceId': serviceId,
    needServiceReply: true,
    status: { $in: ['in_progress', 'waiting_user'] },
  })
    .sort({ updatedAt: -1 })
    .lean();
  
  return tickets;
}

// ==================== 工单服务 ====================

/**
 * 用户进线 - 创建新工单
 */
export async function createTicket(userId, userInfo = {}, firstMessage = '') {
  // 检查是否有未关闭的工单
  const existingTicket = await Ticket.findOne({
    userId,
    status: { $in: ['ai_chatting', 'pending', 'in_progress', 'waiting_user'] },
  });
  
  if (existingTicket) {
    const messages = await Message.find({ ticketId: existingTicket.ticketId })
      .sort({ createdAt: 1 })
      .lean();
    return {
      ticket: existingTicket,
      messages,
      isNew: false,
    };
  }
  
  // 创建新工单
  const category = detectCategory(firstMessage);
  const title = firstMessage ? firstMessage.substring(0, 50) : '新咨询';
  
  const ticket = await Ticket.create({
    userId,
    userInfo: {
      nickname: userInfo.nickname || '用户',
      avatar: userInfo.avatar || '',
      phone: userInfo.phone || '',
    },
    category,
    title,
    status: 'ai_chatting',
  });
  
  // 创建系统欢迎消息
  await Message.create({
    ticketId: ticket.ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: '客服小象已上线，很高兴为您服务~ 🐘',
  });
  
  // AI 欢迎消息
  const aiWelcome = await Message.create({
    ticketId: ticket.ticketId,
    senderId: 'ai_service',
    senderType: 'ai',
    senderInfo: { nickname: '小象客服', avatar: '' },
    content: '您好！我是小象客服，请问有什么可以帮助您的吗？您可以直接描述您的问题，我会尽力为您解答~',
  });
  
  // 更新工单最后消息
  await Ticket.updateOne(
    { ticketId: ticket.ticketId },
    {
      lastMessage: {
        content: aiWelcome.content,
        senderType: 'ai',
        createdAt: aiWelcome.createdAt,
      },
    }
  );
  
  return {
    ticket,
    messages: [aiWelcome],
    isNew: true,
  };
}

/**
 * 用户发送消息
 */
export async function sendUserMessage(ticketId, userId, content, messageType = 'text', attachment = null) {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  if (ticket.status === 'closed') {
    throw new Error('工单已关闭，请重新进线');
  }
  
  // 创建用户消息
  const message = await Message.create({
    ticketId,
    senderId: userId,
    senderType: 'user',
    senderInfo: ticket.userInfo,
    messageType,
    content,
    attachment,
    isRead: false,
  });
  
  // 更新工单
  await Ticket.updateOne(
    { ticketId },
    {
      lastMessage: {
        content: content.substring(0, 100),
        senderType: 'user',
        createdAt: message.createdAt,
      },
      userLastActiveAt: new Date(),
      $inc: { 'unreadCount.service': 1 },
      needServiceReply: true,
      updatedAt: new Date(),
    }
  );
  
  // 判断是否需要 AI 回复
  let aiReply = null;
  let serviceWelcome = null;
  
  if (ticket.status === 'ai_chatting') {
    // 检测是否要转人工
    const shouldTransfer = detectTransferIntent(content);
    
    if (shouldTransfer) {
      // 转人工处理
      const transferResult = await handleTransferToHuman(ticketId);
      aiReply = transferResult.systemMessage;
      
      // 检查是否有在线客服可以自动接单
      serviceWelcome = await tryAutoAssign(ticketId);
    } else {
      // AI 正常回复
      aiReply = await generateAIReply(ticketId, content);
    }
  }
  
  // 如果工单已被客服接起，更新状态为等待用户
  if (ticket.status === 'waiting_user') {
    await Ticket.updateOne(
      { ticketId },
      { status: 'in_progress', updatedAt: new Date() }
    );
  }
  
  return {
    message,
    aiReply,
    serviceWelcome,
    ticketStatus: (await Ticket.findOne({ ticketId })).status,
  };
}

/**
 * 检测转人工意图
 */
function detectTransferIntent(content) {
  const lowerContent = content.toLowerCase();
  return TRANSFER_KEYWORDS.some(keyword => lowerContent.includes(keyword));
}

/**
 * 处理转人工
 */
async function handleTransferToHuman(ticketId) {
  // 更新工单状态
  await Ticket.updateOne(
    { ticketId },
    {
      status: 'pending',
      isTransferredToHuman: true,
      transferredAt: new Date(),
      needServiceReply: true,
      updatedAt: new Date(),
    }
  );
  
  // 创建转人工提示消息
  const systemMessage = await Message.create({
    ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: '您已申请转接人工客服，正在为您分配客服，请稍候~',
  });
  
  return { systemMessage };
}

/**
 * 尝试自动分配客服
 */
async function tryAutoAssign(ticketId) {
  // 查找开启自动接单且在线的客服
  const onlineStaff = await ServiceStaff.findOne({
    onlineStatus: 'online',
    isAutoAssign: true,
  });
  
  if (onlineStaff) {
    // 自动分配
    await assignTicketToService(ticketId, onlineStaff.serviceId, true);
    
    // 返回欢迎消息
    const welcomeMessage = await Message.findOne({
      ticketId,
      senderType: 'service',
    }).sort({ createdAt: -1 });
    
    return welcomeMessage;
  }
  
  return null;
}

/**
 * 客服回复
 */
export async function serviceReply(ticketId, serviceId, content, messageType = 'text', attachment = null) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  // 如果工单是 pending 状态，自动接单
  if (ticket.status === 'pending') {
    await assignTicketToService(ticketId, serviceId, false);
  }
  
  // 创建消息
  const message = await Message.create({
    ticketId,
    senderId: serviceId,
    senderType: 'service',
    senderInfo: {
      nickname: staff.nickname,
      avatar: staff.avatar,
      serviceNumber: staff.serviceId,
    },
    messageType,
    content,
    attachment,
    isRead: false,
  });
  
  // 更新工单
  await Ticket.updateOne(
    { ticketId },
    {
      status: 'waiting_user',
      lastMessage: {
        content: content.substring(0, 100),
        senderType: 'service',
        createdAt: message.createdAt,
      },
      serviceLastReplyAt: new Date(),
      needServiceReply: false,
      $set: { 'unreadCount.user': 0 },
      updatedAt: new Date(),
    }
  );
  
  // 更新客服统计
  await ServiceStaff.updateOne(
    { serviceId },
    { $inc: { 'stats.totalResolved': 1, 'stats.todayResolved': 1 } }
  );
  
  return message;
}

/**
 * 关闭工单
 */
export async function closeTicket(ticketId, serviceId) {
  const result = await Ticket.updateOne(
    { ticketId },
    {
      status: 'closed',
      closedAt: new Date(),
      updatedAt: new Date(),
    }
  );
  
  if (result.modifiedCount > 0) {
    // 从客服活跃列表移除
    await ServiceStaff.updateOne(
      { serviceId },
      { $pull: { activeTicketIds: ticketId } }
    );
    
    // 创建关闭消息
    await Message.create({
      ticketId,
      senderId: 'system',
      senderType: 'system',
      senderInfo: { nickname: '系统' },
      content: '工单已关闭。如有其他问题，欢迎再次咨询~',
    });
  }
  
  return result.modifiedCount > 0;
}

/**
 * 获取工单详情
 */
export async function getTicketDetail(ticketId) {
  const ticket = await Ticket.findOne({ ticketId }).lean();
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  const messages = await Message.find({ ticketId })
    .sort({ createdAt: 1 })
    .lean();
  
  return { ticket, messages };
}

// ==================== AI 智能回复 ====================

/**
 * 生成 AI 回复
 */
export async function generateAIReply(ticketId, userMessage) {
  try {
    // 1. 先尝试匹配 FAQ
    const faqReply = await matchFAQ(userMessage);
    if (faqReply) {
      return await saveAIMessage(ticketId, faqReply);
    }
    
    // 2. 获取对话历史
    const messages = await Message.find({ ticketId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    const context = messages.reverse()
      .filter(m => m.senderType !== 'system')
      .map(msg => ({
        role: msg.senderType === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));
    
    // 3. 调用 AI
    const ai = await initAI();
    
    const completion = await ai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是小象客服，一个友好、专业的在线客服助手。
你的职责是帮助用户解答关于任务接取、提现、账号、审核等问题。

回复规则：
1. 用简洁、友好的语气回复，每次回复控制在100字以内
2. 可以使用适当的表情符号增加亲和力
3. 如果用户问题你无法解决，建议用户说"转人工"联系人工客服
4. 不要编造信息，不确定的问题引导用户转人工

常见问题参考：
- 提现：进入"我的"→"钱包"→选择提现金额→绑定支付宝/微信→提现
- 任务：首页点击"大厅"→选择任务→点击"立即参与"
- 审核：一般24小时内完成，请耐心等待
- 账号：可在"设置"中修改手机号、密码等`,
        },
        ...context,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    const replyContent = completion.choices[0]?.message?.content ||
      '抱歉，我暂时无法回答这个问题。如需进一步帮助，请回复"转人工"联系人工客服~';
    
    return await saveAIMessage(ticketId, replyContent);
    
  } catch (error) {
    console.error('[AI回复] 生成失败:', error);
    return await saveAIMessage(
      ticketId,
      '抱歉，系统暂时繁忙。如需帮助，请回复"转人工"联系人工客服~'
    );
  }
}

/**
 * 匹配 FAQ
 */
async function matchFAQ(userMessage) {
  const keywords = extractKeywords(userMessage);
  
  if (keywords.length === 0) return null;
  
  const faq = await FAQ.findOne({
    keywords: { $in: keywords },
    isActive: true,
  }).sort({ matchCount: -1, viewCount: -1 });
  
  if (faq) {
    await FAQ.updateOne({ _id: faq._id }, { $inc: { matchCount: 1, viewCount: 1 } });
    return faq.answer;
  }
  
  return null;
}

/**
 * 提取关键词
 */
function extractKeywords(message) {
  const keywordMap = {
    '提现': ['提现', '取钱', '余额', '钱包', '提钱', '提款', '到账'],
    '任务': ['任务', '接任务', '悬赏', '大厅', '接单', '做任务'],
    '审核': ['审核', '通过', '拒绝', '审核中', '审核失败'],
    '账号': ['账号', '登录', '注册', '密码', '手机号', '验证码'],
    '邀请': ['邀请', '好友', '推荐', '邀请码'],
    '收益': ['收益', '赚钱', '佣金', '收入'],
  };
  
  const keywords = [];
  for (const [key, values] of Object.entries(keywordMap)) {
    if (values.some(v => message.includes(v))) {
      keywords.push(key);
    }
  }
  return keywords;
}

/**
 * 保存 AI 消息
 */
async function saveAIMessage(ticketId, content) {
  const message = await Message.create({
    ticketId,
    senderId: 'ai_service',
    senderType: 'ai',
    senderInfo: { nickname: '小象客服', avatar: '' },
    messageType: 'text',
    content,
    isRead: false,
  });
  
  await Ticket.updateOne(
    { ticketId },
    {
      lastMessage: {
        content: content.substring(0, 100),
        senderType: 'ai',
        createdAt: message.createdAt,
      },
      $inc: { 'unreadCount.user': 1 },
      updatedAt: new Date(),
    }
  );
  
  return message;
}

/**
 * 检测问题分类
 */
function detectCategory(content) {
  if (!content) return 'other';
  
  const categoryKeywords = {
    task: ['任务', '接任务', '悬赏', '大厅', '接单', '做任务', '任务审核'],
    withdraw: ['提现', '取钱', '余额', '钱包', '提钱', '提款', '到账'],
    account: ['账号', '登录', '注册', '密码', '手机号', '验证码', '绑定'],
    audit: ['审核', '通过', '拒绝', '审核中', '审核失败', '审核通过'],
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => content.includes(kw))) {
      return category;
    }
  }
  return 'other';
}

// ==================== FAQ 服务 ====================

export async function getFAQList(filters = {}, page = 1, limit = 20) {
  const query = { isActive: true };
  if (filters.category) query.category = filters.category;
  
  const skip = (page - 1) * limit;
  
  const [list, total] = await Promise.all([
    FAQ.find(query).sort({ sortOrder: 1, matchCount: -1 }).skip(skip).limit(limit).lean(),
    FAQ.countDocuments(query),
  ]);
  
  return {
    list,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createFAQ(data) {
  return await FAQ.create({
    question: data.question,
    answer: data.answer,
    category: data.category || 'other',
    keywords: data.keywords || [],
    sortOrder: data.sortOrder || 0,
  });
}

export async function updateFAQ(faqId, data) {
  const result = await FAQ.updateOne({ _id: faqId }, { ...data, updatedAt: new Date() });
  return result.modifiedCount > 0;
}

export async function deleteFAQ(faqId) {
  const result = await FAQ.deleteOne({ _id: faqId });
  return result.deletedCount > 0;
}

// ==================== 快捷回复服务 ====================

export async function getQuickReplies(serviceId) {
  return await QuickReply.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
}

export async function createQuickReply(data, serviceId) {
  return await QuickReply.create({
    ...data,
    createdBy: serviceId,
  });
}

// ==================== 统计服务 ====================

export async function getStatistics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [totalTickets, pendingTickets, todayTickets, totalMessages, avgRating] = await Promise.all([
    Ticket.countDocuments(),
    Ticket.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
    Ticket.countDocuments({ createdAt: { $gte: today } }),
    Message.countDocuments(),
    Ticket.aggregate([
      { $match: { 'rating.score': { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$rating.score' } } },
    ]),
  ]);
  
  return {
    totalTickets,
    pendingTickets,
    todayTickets,
    totalMessages,
    avgRating: avgRating[0]?.avg?.toFixed(1) || '0.0',
  };
}

export default {
  initSuperAdmin,
  serviceOnline,
  serviceOffline,
  toggleAutoAssign,
  getServiceWorkbench,
  getNeedReplyTickets,
  createTicket,
  sendUserMessage,
  serviceReply,
  closeTicket,
  getTicketDetail,
  getFAQList,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getQuickReplies,
  createQuickReply,
  getStatistics,
};

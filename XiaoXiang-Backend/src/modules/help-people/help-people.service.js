// src/modules/help-people/help-people.service.js
// 客服服务层 - 规范版（参考美团/淘宝客服系统）

import ZAI from 'z-ai-web-dev-sdk';
import models from './help-people.model.js';

const { 
  FAQCategory, 
  FAQFlow, 
  ServiceStaff, 
  Ticket, 
  Message, 
  ServiceGroup, 
  ServiceHistory, 
  QuickReply 
} = models;

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
  '转客服', '接人工', '人工回复', '投诉'
];

// ==================== FAQ服务 ====================

/**
 * 获取FAQ分类列表（主FAQ）
 */
export async function getFAQCategories() {
  const categories = await FAQCategory.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
  
  // 获取每个分类下的流程数量
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const count = await FAQFlow.countDocuments({ 
        categoryId: cat.categoryId, 
        isActive: true 
      });
      return { ...cat, flowCount: count };
    })
  );
  
  return categoriesWithCount;
}

/**
 * 获取FAQ流程列表（次流程）
 */
export async function getFAQFlows(categoryId = null) {
  const query = { isActive: true };
  if (categoryId) query.categoryId = categoryId;
  
  const flows = await FAQFlow.find(query)
    .sort({ sortOrder: 1, useCount: -1 })
    .lean();
  
  return flows;
}

/**
 * 获取完整FAQ树（主FAQ + 次流程）
 */
export async function getFAQTree() {
  const categories = await FAQCategory.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
  
  const flows = await FAQFlow.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .lean();
  
  // 组装树形结构
  const tree = categories.map(cat => ({
    ...cat,
    flows: flows.filter(f => f.categoryId === cat.categoryId),
  }));
  
  return tree;
}

/**
 * 创建FAQ分类
 */
export async function createFAQCategory(data) {
  return await FAQCategory.create({
    name: data.name,
    icon: data.icon || 'question-circle',
    color: data.color || '#1890ff',
    sortOrder: data.sortOrder || 0,
  });
}

/**
 * 创建FAQ流程
 */
export async function createFAQFlow(data) {
  const flow = await FAQFlow.create({
    categoryId: data.categoryId,
    title: data.title,
    description: data.description || '',
    script: data.script,
    keywords: data.keywords || [],
    needTicket: data.needTicket || false,
    ticketType: data.ticketType || 'consultation',
    sortOrder: data.sortOrder || 0,
  });
  
  // 更新分类的流程数量
  await FAQCategory.updateOne(
    { categoryId: data.categoryId },
    { $inc: { flowCount: 1 } }
  );
  
  return flow;
}

/**
 * 使用FAQ流程回复
 */
export async function useFAQFlow(flowId, ticketId, serviceId) {
  const flow = await FAQFlow.findOne({ flowId });
  if (!flow) {
    throw new Error('FAQ流程不存在');
  }
  
  // 更新使用次数
  await FAQFlow.updateOne(
    { flowId },
    { $inc: { useCount: 1 } }
  );
  
  // 创建消息
  const message = await Message.create({
    ticketId,
    senderId: serviceId,
    senderType: 'service',
    messageType: 'faq',
    content: flow.script,
    faqSource: {
      flowId: flow.flowId,
      categoryId: flow.categoryId,
      flowTitle: flow.title,
    },
  });
  
  return { flow, message };
}

// ==================== 客服管理服务 ====================

/**
 * 初始化超级管理员客服（001号）
 */
export async function initSuperAdmin() {
  const existing = await ServiceStaff.findOne({ serviceId: '001' });
  
  if (!existing) {
    await ServiceStaff.create({
      serviceId: '001',
      nickname: '超级管理员',
      role: 'super_admin',
      onlineStatus: 'offline',
      isAutoAssign: false,
      groupId: 'admin',
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
 * 获取在线客服列表
 */
export async function getOnlineStaff() {
  return await ServiceStaff.find({ 
    onlineStatus: 'online' 
  }).lean();
}

/**
 * 获取所有客服列表（超级管理员用）
 */
export async function getAllStaff(serviceId) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff || staff.role !== 'super_admin') {
    throw new Error('无权限');
  }
  
  return await ServiceStaff.find().sort({ serviceId: 1 }).lean();
}

// ==================== 工单服务 ====================

/**
 * 用户进线 - 创建新工单
 */
export async function createTicket(userId, userInfo = {}, firstMessage = '') {
  // 检查是否有未关闭的工单
  const existingTicket = await Ticket.findOne({
    userId,
    status: { $in: ['ai_chatting', 'queuing', 'pending', 'in_progress', 'waiting_user'] },
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
    source: 'app',
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
  
  // 创建服务历史记录
  await ServiceHistory.create({
    userId,
    ticketId: ticket.ticketId,
    issueType: '咨询问题',
    progress: 'AI客服接待中',
    description: title,
  });
  
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
      
      // 尝试自动分配客服
      serviceWelcome = await tryAutoAssign(ticketId);
    } else {
      // AI 正常回复
      aiReply = await generateAIReply(ticketId, content);
    }
  }
  
  // 如果工单状态是waiting_user，更新为in_progress
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
  // 更新工单状态为排队中
  await Ticket.updateOne(
    { ticketId },
    {
      status: 'queuing',
      needServiceReply: true,
      updatedAt: new Date(),
      $push: {
        processLogs: {
          time: new Date(),
          operatorId: 'system',
          operatorName: '系统',
          action: '转人工',
          content: '用户申请转人工客服',
        }
      }
    }
  );
  
  // 更新服务历史
  await ServiceHistory.findOneAndUpdate(
    { ticketId },
    {
      progress: '排队等待客服',
      updatedAt: new Date(),
    }
  );
  
  // 创建转人工提示消息
  const systemMessage = await Message.create({
    ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: '您已申请转接人工客服，正在为您排队，请稍候~',
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
    await assignTicketToService(ticketId, onlineStaff.serviceId, true);
    
    const welcomeMessage = await Message.findOne({
      ticketId,
      senderType: 'service',
    }).sort({ createdAt: -1 });
    
    return welcomeMessage;
  }
  
  return null;
}

/**
 * 分配工单给客服
 */
async function assignTicketToService(ticketId, serviceId, sendWelcome = true) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new Error('工单不存在');
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
      'assignedTo.groupId': staff.groupId,
      firstResponseAt: ticket.firstResponseAt || new Date(),
      updatedAt: new Date(),
      $push: {
        processLogs: {
          time: new Date(),
          operatorId: serviceId,
          operatorName: staff.nickname,
          action: '分配客服',
          content: `${staff.serviceId}号${staff.nickname}接单`,
        }
      }
    }
  );
  
  // 更新客服的活跃工单列表
  await ServiceStaff.updateOne(
    { serviceId },
    {
      $addToSet: { activeTicketIds: ticketId },
      $inc: { 'stats.totalChats': 1, 'stats.todayChats': 1 },
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
  
  // 更新服务历史
  await ServiceHistory.findOneAndUpdate(
    { ticketId },
    {
      progress: `${staff.nickname}客服处理中`,
      'serviceInfo.serviceId': serviceId,
      'serviceInfo.nickname': staff.nickname,
      'serviceInfo.serviceNumber': staff.serviceId,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );
  
  return true;
}

/**
 * 转接工单
 */
export async function transferTicket(ticketId, fromServiceId, toServiceId, reason = '') {
  const fromStaff = await ServiceStaff.findOne({ serviceId: fromServiceId });
  const toStaff = await ServiceStaff.findOne({ serviceId: toServiceId });
  
  if (!toStaff) {
    throw new Error('目标客服不存在');
  }
  
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  // 更新工单
  await Ticket.updateOne(
    { ticketId },
    {
      'assignedTo.serviceId': toServiceId,
      'assignedTo.serviceInfo': {
        nickname: toStaff.nickname,
        avatar: toStaff.avatar,
        serviceNumber: toStaff.serviceId,
      },
      'transferInfo': {
        fromServiceId,
        fromServiceName: fromStaff?.nickname || '',
        toServiceId,
        toServiceName: toStaff.nickname,
        transferReason: reason,
        transferredAt: new Date(),
      },
      updatedAt: new Date(),
      $push: {
        processLogs: {
          time: new Date(),
          operatorId: fromServiceId,
          operatorName: fromStaff?.nickname || '系统',
          action: '转接工单',
          content: `转接给${toStaff.serviceId}号${toStaff.nickname}，原因：${reason || '无'}`,
        }
      }
    }
  );
  
  // 更新客服活跃工单列表
  await ServiceStaff.updateOne(
    { serviceId: fromServiceId },
    { $pull: { activeTicketIds: ticketId } }
  );
  
  await ServiceStaff.updateOne(
    { serviceId: toServiceId },
    { $addToSet: { activeTicketIds: ticketId } }
  );
  
  // 创建转接消息
  await Message.create({
    ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: `您的工单已转接给${toStaff.serviceId}号${toStaff.nickname}，请稍候~`,
  });
  
  // 更新服务历史
  await ServiceHistory.findOneAndUpdate(
    { ticketId },
    {
      progress: `${toStaff.nickname}客服处理中`,
      'serviceInfo.serviceId': toServiceId,
      'serviceInfo.nickname': toStaff.nickname,
      'serviceInfo.serviceNumber': toStaff.serviceId,
      updatedAt: new Date(),
    }
  );
  
  return true;
}

/**
 * 客服回复
 */
export async function serviceReply(ticketId, serviceId, content, messageType = 'text', attachment = null, faqSource = null) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  // 如果工单是 pending/queuing 状态，自动接单
  if (['pending', 'queuing'].includes(ticket.status)) {
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
    faqSource,
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
export async function closeTicket(ticketId, serviceId, closeData = {}) {
  const staff = await ServiceStaff.findOne({ serviceId });
  
  const result = await Ticket.updateOne(
    { ticketId },
    {
      status: 'closed',
      closedAt: new Date(),
      closeInfo: {
        closeType: closeData.closeType || 'resolved',
        closeReason: closeData.closeReason || '',
        satisfaction: closeData.satisfaction || 5,
        remark: closeData.remark || '',
        closedAt: new Date(),
      },
      solution: closeData.solution || '',
      updatedAt: new Date(),
      $push: {
        processLogs: {
          time: new Date(),
          operatorId: serviceId,
          operatorName: staff?.nickname || '系统',
          action: '关闭工单',
          content: closeData.closeReason || '工单已完结',
        }
      }
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
    
    // 更新服务历史
    await ServiceHistory.findOneAndUpdate(
      { ticketId },
      {
        progress: '已解决',
        updatedAt: new Date(),
      }
    );
  }
  
  return result.modifiedCount > 0;
}

/**
 * 获取客服工作台数据
 */
export async function getServiceWorkbench(serviceId) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff) {
    throw new Error('客服不存在');
  }
  
  const isSuperAdmin = staff.role === 'super_admin';
  
  // 构建查询条件
  const myTicketsQuery = isSuperAdmin 
    ? { status: { $in: ['in_progress', 'waiting_user'] } }
    : { 'assignedTo.serviceId': serviceId, status: { $in: ['in_progress', 'waiting_user'] } };
  
  const resolvedQuery = isSuperAdmin
    ? { status: 'resolved' }
    : { 'assignedTo.serviceId': serviceId, status: 'resolved' };
  
  // 获取各状态工单数量
  const [pendingCount, queuingCount, inProgressCount, waitingUserCount, resolvedCount] = await Promise.all([
    Ticket.countDocuments({ status: 'pending' }),
    Ticket.countDocuments({ status: 'queuing' }),
    Ticket.countDocuments(myTicketsQuery),
    Ticket.countDocuments({ ...myTicketsQuery, needServiceReply: true }),
    Ticket.countDocuments(resolvedQuery),
  ]);
  
  // 获取待处理工单列表
  const pendingTickets = await Ticket.find({ 
    status: { $in: ['pending', 'queuing'] } 
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(20)
    .lean();
  
  // 获取我的工单列表
  const myTickets = await Ticket.find(myTicketsQuery)
    .sort({ needServiceReply: -1, updatedAt: -1 })
    .lean();
  
  // 获取已解决工单
  const resolvedTickets = await Ticket.find(resolvedQuery)
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();
  
  // 获取FAQ分类
  const faqCategories = await getFAQCategories();
  
  // 获取在线客服列表（用于转接）
  const onlineStaff = await getOnlineStaff();
  
  return {
    staffInfo: staff,
    stats: {
      pending: pendingCount,
      queuing: queuingCount,
      inProgress: inProgressCount,
      waitingUser: waitingUserCount,
      resolved: resolvedCount,
    },
    pendingTickets,
    myTickets,
    resolvedTickets,
    faqCategories,
    onlineStaff: onlineStaff.filter(s => s.serviceId !== serviceId),
    isSuperAdmin,
  };
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

/**
 * 获取工单完整详情
 */
export async function getTicketFullDetail(ticketId) {
  const ticket = await Ticket.findOne({ ticketId }).lean();
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
  const messages = await Message.find({ ticketId })
    .sort({ createdAt: 1 })
    .lean();
  
  return {
    ticket,
    messages,
    detail: {
      userRequirement: ticket.userRequirement || '',
      issueType: ticket.issueType || 'consultation',
      solution: ticket.solution || '',
      closeInfo: ticket.closeInfo || {},
      processLogs: ticket.processLogs || [],
    }
  };
}

/**
 * 保存工单详情
 */
export async function saveTicketDetail(ticketId, detailData, serviceId = '001') {
  const staff = await ServiceStaff.findOne({ serviceId });
  
  const updateData = {
    userRequirement: detailData.userRequirement || '',
    issueType: detailData.issueType || 'consultation',
    solution: detailData.solution || '',
    'closeInfo.closeType': detailData.closeType || 'resolved',
    'closeInfo.closeReason': detailData.closeReason || '',
    'closeInfo.satisfaction': detailData.satisfaction || 5,
    'closeInfo.remark': detailData.remark || '',
    updatedAt: new Date(),
  };
  
  if (detailData.addLog) {
    updateData.$push = {
      processLogs: {
        time: new Date(),
        operatorId: serviceId,
        operatorName: staff?.nickname || '系统',
        action: detailData.action || '更新工单',
        content: detailData.logContent || '更新了工单信息',
      }
    };
  }
  
  const result = await Ticket.updateOne({ ticketId }, updateData);
  
  if (result.modifiedCount > 0) {
    return await Ticket.findOne({ ticketId }).lean();
  }
  
  return null;
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
  const flows = await FAQFlow.find({ 
    isActive: true,
    keywords: { $exists: true, $ne: [] }
  }).lean();
  
  for (const flow of flows) {
    if (flow.keywords.some(kw => userMessage.includes(kw))) {
      // 更新匹配次数
      await FAQFlow.updateOne(
        { flowId: flow.flowId },
        { $inc: { matchCount: 1 } }
      );
      return flow.script;
    }
  }
  
  return null;
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

// ==================== 服务历史 ====================

export async function getUserServiceHistory(userId) {
  const history = await ServiceHistory.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  
  const ticketIds = history.map(h => h.ticketId);
  const tickets = await Ticket.find({ ticketId: { $in: ticketIds } })
    .select('ticketId title status category createdAt closedAt')
    .lean();
  
  const ticketMap = tickets.reduce((acc, t) => {
    acc[t.ticketId] = t;
    return acc;
  }, {});
  
  return history.map(h => ({
    ...h,
    ticket: ticketMap[h.ticketId] || null,
  }));
}

// ==================== 快捷回复 ====================

export async function getQuickReplies() {
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

// ==================== 导出 ====================

const helpService = {
  // FAQ
  getFAQCategories,
  getFAQFlows,
  getFAQTree,
  createFAQCategory,
  createFAQFlow,
  useFAQFlow,
  
  // 客服管理
  initSuperAdmin,
  serviceOnline,
  serviceOffline,
  getOnlineStaff,
  getAllStaff,
  
  // 工单
  createTicket,
  sendUserMessage,
  transferTicket,
  serviceReply,
  closeTicket,
  getServiceWorkbench,
  getTicketDetail,
  getTicketFullDetail,
  saveTicketDetail,
  
  // 服务历史
  getUserServiceHistory,
  
  // 快捷回复
  getQuickReplies,
  createQuickReply,
};

export default helpService;

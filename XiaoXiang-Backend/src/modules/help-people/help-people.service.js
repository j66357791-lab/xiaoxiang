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
  const categories = await FAQCategory.find({})
    .sort({ sortOrder: 1 })
    .lean();
  
  // 获取每个分类下的流程数量
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const count = await FAQFlow.countDocuments({ 
        categoryId: cat.categoryId
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
  const query = {};
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
  const categories = await FAQCategory.find({})
    .sort({ sortOrder: 1 })
    .lean();
  
  const flows = await FAQFlow.find({})
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
  const category = await FAQCategory.create({
    name: data.name,
    icon: data.icon || 'question-circle',
    color: data.color || '#1890ff',
    sortOrder: data.sortOrder || 0,
    isActive: data.isActive !== false,
  });
  
  return category;
}

/**
 * 更新FAQ分类
 */
export async function updateFAQCategory(categoryId, data) {
  const result = await FAQCategory.updateOne(
    { categoryId },
    {
      $set: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        updatedAt: new Date(),
      }
    }
  );
  
  if (result.modifiedCount > 0) {
    return await FAQCategory.findOne({ categoryId }).lean();
  }
  return null;
}

/**
 * 删除FAQ分类
 */
export async function deleteFAQCategory(categoryId) {
  // 先删除该分类下的所有流程
  await FAQFlow.deleteMany({ categoryId });
  
  // 再删除分类
  const result = await FAQCategory.deleteOne({ categoryId });
  
  return result.deletedCount > 0;
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
    isActive: data.isActive !== false,
  });
  
  return flow;
}

/**
 * 更新FAQ流程
 */
export async function updateFAQFlow(flowId, data) {
  const updateData = {
    categoryId: data.categoryId,
    title: data.title,
    description: data.description,
    script: data.script,
    keywords: data.keywords || [],
    needTicket: data.needTicket,
    ticketType: data.ticketType,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
    updatedAt: new Date(),
  };
  
  const result = await FAQFlow.updateOne(
    { flowId },
    { $set: updateData }
  );
  
  if (result.modifiedCount > 0) {
    return await FAQFlow.findOne({ flowId }).lean();
  }
  return null;
}

/**
 * 删除FAQ流程
 */
export async function deleteFAQFlow(flowId) {
  const result = await FAQFlow.deleteOne({ flowId });
  return result.deletedCount > 0;
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

/**
 * 初始化默认FAQ数据
 */
export async function initDefaultFAQ() {
  // 检查是否已有数据
  const existingCategories = await FAQCategory.countDocuments();
  if (existingCategories > 0) {
    return { message: 'FAQ数据已存在' };
  }
  
  // 创建默认分类
  const categories = await FAQCategory.insertMany([
    { categoryId: 'CAT001', name: '提现问题', color: '#1890ff', sortOrder: 1 },
    { categoryId: 'CAT002', name: '任务问题', color: '#52c41a', sortOrder: 2 },
    { categoryId: 'CAT003', name: '账号问题', color: '#722ed1', sortOrder: 3 },
    { categoryId: 'CAT004', name: '审核问题', color: '#faad14', sortOrder: 4 },
    { categoryId: 'CAT005', name: '其他问题', color: '#eb2f96', sortOrder: 5 },
  ]);
  
  // 创建默认流程
  const flows = await FAQFlow.insertMany([
    { flowId: 'FLOW001', categoryId: 'CAT001', title: '提现失败怎么办？', script: '请检查您的支付宝账号是否正确，确保账号已完成实名认证。如仍有问题，请提供截图联系客服处理。', keywords: ['提现', '失败', '提现失败'], useCount: 0 },
    { flowId: 'FLOW002', categoryId: 'CAT001', title: '提现多久到账？', script: '一般情况下，提现会在24小时内到账。如遇节假日可能稍有延迟，请耐心等待。', keywords: ['提现', '到账', '多久'], useCount: 0 },
    { flowId: 'FLOW003', categoryId: 'CAT001', title: '提现金额限制', script: '单次提现最低10元，最高5000元。每日最多提现3次。', keywords: ['提现', '金额', '限制', '最低', '最高'], useCount: 0 },
    { flowId: 'FLOW004', categoryId: 'CAT002', title: '如何接取任务？', script: '在首页点击"大厅"进入悬赏大厅，选择您感兴趣的任务，点击"立即参与"即可接取任务。', keywords: ['任务', '接取', '接任务'], useCount: 0 },
    { flowId: 'FLOW005', categoryId: 'CAT002', title: '任务审核多久？', script: '任务审核一般在24小时内完成，请耐心等待。审核通过后奖励会自动发放到您的账户。', keywords: ['任务', '审核', '多久'], useCount: 0 },
    { flowId: 'FLOW006', categoryId: 'CAT002', title: '任务失败怎么办？', script: '如果任务失败，请检查是否按要求完成。您可以重新接取任务再次尝试，如有疑问请联系客服。', keywords: ['任务', '失败'], useCount: 0 },
    { flowId: 'FLOW007', categoryId: 'CAT003', title: '如何修改手机号？', script: '进入"我的"→"设置"→"账号安全"→"修改手机号"，按提示操作即可。', keywords: ['手机号', '修改'], useCount: 0 },
    { flowId: 'FLOW008', categoryId: 'CAT003', title: '忘记密码怎么办？', script: '在登录页面点击"忘记密码"，通过手机验证码重置密码即可。', keywords: ['密码', '忘记'], useCount: 0 },
    { flowId: 'FLOW009', categoryId: 'CAT004', title: '审核标准是什么？', script: '任务审核主要检查：1.提交的截图是否清晰；2.是否按要求完成任务；3.是否存在作弊行为。', keywords: ['审核', '标准'], useCount: 0 },
    { flowId: 'FLOW010', categoryId: 'CAT004', title: '审核被拒绝怎么办？', script: '如果审核被拒绝，请查看拒绝原因，按要求重新提交。如认为审核有误，请联系客服申诉。', keywords: ['审核', '拒绝', '被拒绝'], useCount: 0 },
  ]);
  
  return { 
    message: '初始化成功',
    categories: categories.length,
    flows: flows.length
  };
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

/**
 * 自动接起待处理工单
 */
async function autoAssignPendingTickets(serviceId) {
  const staff = await ServiceStaff.findOne({ serviceId });
  if (!staff || staff.onlineStatus !== 'online') {
    return 0;
  }
  
  const pendingTickets = await Ticket.find({
    status: { $in: ['pending', 'queuing'] },
    'assignedTo.serviceId': null,
  }).sort({ createdAt: 1 });
  
  let assignedCount = 0;
  
  for (const ticket of pendingTickets) {
    if (staff.activeTicketIds.length >= staff.maxActiveTickets) {
      break;
    }
    
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
  
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new Error('工单不存在');
  }
  
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
  
  await ServiceStaff.updateOne(
    { serviceId },
    {
      $addToSet: { activeTicketIds: ticketId },
      $inc: { 'stats.totalChats': 1, 'stats.todayChats': 1 },
      updatedAt: new Date(),
    }
  );
  
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

// ==================== 工单服务 ====================

/**
 * 用户进线 - 创建新工单
 */
export async function createTicket(userId, userInfo = {}, firstMessage = '') {
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
  
  await Message.create({
    ticketId: ticket.ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: '客服小象已上线，很高兴为您服务~ 🐘',
  });
  
  const aiWelcome = await Message.create({
    ticketId: ticket.ticketId,
    senderId: 'ai_service',
    senderType: 'ai',
    senderInfo: { nickname: '小象客服', avatar: '' },
    content: '您好！我是小象客服，请问有什么可以帮助您的吗？您可以直接描述您的问题，我会尽力为您解答~',
  });
  
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
  
  let aiReply = null;
  let serviceWelcome = null;
  
  if (ticket.status === 'ai_chatting') {
    const shouldTransfer = detectTransferIntent(content);
    
    if (shouldTransfer) {
      const transferResult = await handleTransferToHuman(ticketId);
      aiReply = transferResult.systemMessage;
      serviceWelcome = await tryAutoAssign(ticketId);
    } else {
      aiReply = await generateAIReply(ticketId, content);
    }
  }
  
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

function detectTransferIntent(content) {
  const lowerContent = content.toLowerCase();
  return TRANSFER_KEYWORDS.some(keyword => lowerContent.includes(keyword));
}

async function handleTransferToHuman(ticketId) {
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
  
  await ServiceHistory.findOneAndUpdate(
    { ticketId },
    {
      progress: '排队等待客服',
      updatedAt: new Date(),
    }
  );
  
  const systemMessage = await Message.create({
    ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: '您已申请转接人工客服，正在为您排队，请稍候~',
  });
  
  return { systemMessage };
}

async function tryAutoAssign(ticketId) {
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
  
  await ServiceStaff.updateOne(
    { serviceId: fromServiceId },
    { $pull: { activeTicketIds: ticketId } }
  );
  
  await ServiceStaff.updateOne(
    { serviceId: toServiceId },
    { $addToSet: { activeTicketIds: ticketId } }
  );
  
  await Message.create({
    ticketId,
    senderId: 'system',
    senderType: 'system',
    senderInfo: { nickname: '系统' },
    content: `您的工单已转接给${toStaff.serviceId}号${toStaff.nickname}，请稍候~`,
  });
  
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
  
  if (['pending', 'queuing'].includes(ticket.status)) {
    await assignTicketToService(ticketId, serviceId, false);
  }
  
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
    await ServiceStaff.updateOne(
      { serviceId },
      { $pull: { activeTicketIds: ticketId } }
    );
    
    await Message.create({
      ticketId,
      senderId: 'system',
      senderType: 'system',
      senderInfo: { nickname: '系统' },
      content: '工单已关闭。如有其他问题，欢迎再次咨询~',
    });
    
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
  
  const myTicketsQuery = isSuperAdmin 
    ? { status: { $in: ['in_progress', 'waiting_user'] } }
    : { 'assignedTo.serviceId': serviceId, status: { $in: ['in_progress', 'waiting_user'] } };
  
  const resolvedQuery = isSuperAdmin
    ? { status: 'resolved' }
    : { 'assignedTo.serviceId': serviceId, status: 'resolved' };
  
  const [pendingCount, queuingCount, inProgressCount, waitingUserCount, resolvedCount] = await Promise.all([
    Ticket.countDocuments({ status: 'pending' }),
    Ticket.countDocuments({ status: 'queuing' }),
    Ticket.countDocuments(myTicketsQuery),
    Ticket.countDocuments({ ...myTicketsQuery, needServiceReply: true }),
    Ticket.countDocuments(resolvedQuery),
  ]);
  
  const pendingTickets = await Ticket.find({ 
    status: { $in: ['pending', 'queuing'] } 
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(20)
    .lean();
  
  const myTickets = await Ticket.find(myTicketsQuery)
    .sort({ needServiceReply: -1, updatedAt: -1 })
    .lean();
  
  const resolvedTickets = await Ticket.find(resolvedQuery)
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();
  
  const faqCategories = await getFAQCategories();
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

async function generateAIReply(ticketId, userMessage) {
  try {
    const faqReply = await matchFAQ(userMessage);
    if (faqReply) {
      return await saveAIMessage(ticketId, faqReply);
    }
    
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
4. 不要编造信息，不确定的问题引导用户转人工`,
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

async function matchFAQ(userMessage) {
  const flows = await FAQFlow.find({ 
    isActive: true,
    keywords: { $exists: true, $ne: [] }
  }).lean();
  
  for (const flow of flows) {
    if (flow.keywords.some(kw => userMessage.includes(kw))) {
      await FAQFlow.updateOne(
        { flowId: flow.flowId },
        { $inc: { matchCount: 1 } }
      );
      return flow.script;
    }
  }
  
  return null;
}

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
  updateFAQCategory,
  deleteFAQCategory,
  createFAQFlow,
  updateFAQFlow,
  deleteFAQFlow,
  useFAQFlow,
  initDefaultFAQ,
  
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

// src/modules/help-people/help-people.controller.js
// 客服控制器 - 优化版

import * as helpService from './help-people.service.js';

// ==================== 客服管理接口 ====================

/**
 * 初始化超级管理员
 */
export async function initSuperAdmin(req, res) {
  try {
    const staff = await helpService.initSuperAdmin();
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[初始化客服] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '初始化失败' });
  }
}

/**
 * 客服上线
 */
export async function serviceOnline(req, res) {
  try {
    const serviceId = req.body.serviceId || req.user?.userId || '001';
    const staff = await helpService.serviceOnline(serviceId);
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[客服上线] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '上线失败' });
  }
}

/**
 * 客服下线
 */
export async function serviceOffline(req, res) {
  try {
    const serviceId = req.body.serviceId || req.user?.userId || '001';
    const staff = await helpService.serviceOffline(serviceId);
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[客服下线] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '下线失败' });
  }
}

/**
 * 切换自动接单模式
 */
export async function toggleAutoAssign(req, res) {
  try {
    const serviceId = req.body.serviceId || req.user?.userId || '001';
    const { isAutoAssign } = req.body;
    const staff = await helpService.toggleAutoAssign(serviceId, isAutoAssign);
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[切换自动接单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '切换失败' });
  }
}

/**
 * 获取客服工作台数据
 */
export async function getServiceWorkbench(req, res) {
  try {
    const serviceId = req.query.serviceId || req.user?.userId || '001';
    const data = await helpService.getServiceWorkbench(serviceId);
    res.json({ code: 200, message: 'success', data });
  } catch (error) {
    console.error('[获取工作台] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

/**
 * 获取需要回复的工单
 */
export async function getNeedReplyTickets(req, res) {
  try {
    const serviceId = req.query.serviceId || req.user?.userId || '001';
    const tickets = await helpService.getNeedReplyTickets(serviceId);
    res.json({ code: 200, message: 'success', data: tickets });
  } catch (error) {
    console.error('[获取待回复工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

// ==================== 用户端接口 ====================

export async function createTicket(req, res) {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { userInfo, firstMessage } = req.body;
    
    if (!userId) {
      return res.status(400).json({ code: 400, message: '缺少用户ID' });
    }
    
    const result = await helpService.createTicket(userId, userInfo, firstMessage);
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[创建工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建工单失败' });
  }
}

export async function getTicketDetail(req, res) {
  try {
    const { ticketId } = req.params;
    const result = await helpService.getTicketDetail(ticketId);
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[获取工单详情] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取工单详情失败' });
  }
}

export async function sendUserMessage(req, res) {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { ticketId, content, messageType, attachment } = req.body;
    
    if (!ticketId || !content) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    const result = await helpService.sendUserMessage(ticketId, userId, content, messageType || 'text', attachment);
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[发送消息] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '发送消息失败' });
  }
}

// ==================== 客服端接口 ====================

export async function serviceReply(req, res) {
  try {
    const serviceId = req.user?.userId || req.body.serviceId || '001';
    const { ticketId, content, messageType, attachment } = req.body;
    
    if (!ticketId || !content) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    const message = await helpService.serviceReply(ticketId, serviceId, content, messageType || 'text', attachment);
    res.json({ code: 200, message: 'success', data: message });
  } catch (error) {
    console.error('[客服回复] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '客服回复失败' });
  }
}

export async function closeTicket(req, res) {
  try {
    const serviceId = req.user?.userId || req.body.serviceId || '001';
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ code: 400, message: '缺少工单ID' });
    }
    
    const result = await helpService.closeTicket(ticketId, serviceId);
    res.json({ code: 200, message: '工单已关闭' });
  } catch (error) {
    console.error('[关闭工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '关闭工单失败' });
  }
}

// ==================== FAQ 接口 ====================

export async function getFAQList(req, res) {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const result = await helpService.getFAQList({ category }, parseInt(page), parseInt(limit));
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[获取FAQ] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取FAQ失败' });
  }
}

export async function createFAQ(req, res) {
  try {
    const faq = await helpService.createFAQ(req.body);
    res.json({ code: 200, message: 'success', data: faq });
  } catch (error) {
    console.error('[创建FAQ] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建FAQ失败' });
  }
}

export async function updateFAQ(req, res) {
  try {
    const { faqId } = req.params;
    await helpService.updateFAQ(faqId, req.body);
    res.json({ code: 200, message: 'success' });
  } catch (error) {
    console.error('[更新FAQ] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '更新FAQ失败' });
  }
}

export async function deleteFAQ(req, res) {
  try {
    const { faqId } = req.params;
    await helpService.deleteFAQ(faqId);
    res.json({ code: 200, message: 'success' });
  } catch (error) {
    console.error('[删除FAQ] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '删除FAQ失败' });
  }
}

// ==================== 快捷回复接口 ====================

export async function getQuickReplies(req, res) {
  try {
    const serviceId = req.query.serviceId || req.user?.userId || '001';
    const replies = await helpService.getQuickReplies(serviceId);
    res.json({ code: 200, message: 'success', data: replies });
  } catch (error) {
    console.error('[获取快捷回复] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

export async function createQuickReply(req, res) {
  try {
    const serviceId = req.user?.userId || '001';
    const reply = await helpService.createQuickReply(req.body, serviceId);
    res.json({ code: 200, message: 'success', data: reply });
  } catch (error) {
    console.error('[创建快捷回复] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建失败' });
  }
}

// ==================== 统计接口 ====================

export async function getStatistics(req, res) {
  try {
    const stats = await helpService.getStatistics();
    res.json({ code: 200, message: 'success', data: stats });
  } catch (error) {
    console.error('[获取统计] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取统计数据失败' });
  }
}

export default {
  initSuperAdmin,
  serviceOnline,
  serviceOffline,
  toggleAutoAssign,
  getServiceWorkbench,
  getNeedReplyTickets,
  createTicket,
  getTicketDetail,
  sendUserMessage,
  serviceReply,
  closeTicket,
  getFAQList,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getQuickReplies,
  createQuickReply,
  getStatistics,
};

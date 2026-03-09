// src/modules/help-people/help-people.controller.js
// 客服控制器 - 规范版

import * as helpService from './help-people.service.js';

// ==================== FAQ接口 ====================

/**
 * 获取FAQ分类列表
 */
export async function getFAQCategories(req, res) {
  try {
    const categories = await helpService.getFAQCategories();
    res.json({ code: 200, message: 'success', data: categories });
  } catch (error) {
    console.error('[获取FAQ分类] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

/**
 * 获取FAQ流程列表
 */
export async function getFAQFlows(req, res) {
  try {
    const { categoryId } = req.query;
    const flows = await helpService.getFAQFlows(categoryId);
    res.json({ code: 200, message: 'success', data: flows });
  } catch (error) {
    console.error('[获取FAQ流程] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

/**
 * 获取FAQ树形结构
 */
export async function getFAQTree(req, res) {
  try {
    const tree = await helpService.getFAQTree();
    res.json({ code: 200, message: 'success', data: tree });
  } catch (error) {
    console.error('[获取FAQ树] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

/**
 * 创建FAQ分类
 */
export async function createFAQCategory(req, res) {
  try {
    const category = await helpService.createFAQCategory(req.body);
    res.json({ code: 200, message: 'success', data: category });
  } catch (error) {
    console.error('[创建FAQ分类] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建失败' });
  }
}

/**
 * 创建FAQ流程
 */
export async function createFAQFlow(req, res) {
  try {
    const flow = await helpService.createFAQFlow(req.body);
    res.json({ code: 200, message: 'success', data: flow });
  } catch (error) {
    console.error('[创建FAQ流程] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建失败' });
  }
}

/**
 * 使用FAQ流程回复
 */
export async function useFAQFlow(req, res) {
  try {
    const { flowId, ticketId } = req.body;
    const serviceId = req.user?.userId || req.body.serviceId || '001';
    
    const result = await helpService.useFAQFlow(flowId, ticketId, serviceId);
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[使用FAQ流程] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '操作失败' });
  }
}

// ==================== 客服管理接口 ====================

export async function initSuperAdmin(req, res) {
  try {
    const staff = await helpService.initSuperAdmin();
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[初始化客服] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '初始化失败' });
  }
}

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

export async function getOnlineStaff(req, res) {
  try {
    const staff = await helpService.getOnlineStaff();
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[获取在线客服] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

export async function getAllStaff(req, res) {
  try {
    const serviceId = req.user?.userId || req.query.serviceId || '001';
    const staff = await helpService.getAllStaff(serviceId);
    res.json({ code: 200, message: 'success', data: staff });
  } catch (error) {
    console.error('[获取所有客服] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取失败' });
  }
}

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

// ==================== 工单接口 ====================

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

export async function getTicketFullDetail(req, res) {
  try {
    const { ticketId } = req.params;
    const result = await helpService.getTicketFullDetail(ticketId);
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[获取工单完整详情] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取工单详情失败' });
  }
}

export async function saveTicketDetail(req, res) {
  try {
    const { ticketId } = req.params;
    const serviceId = req.user?.userId || req.body.serviceId || '001';
    const result = await helpService.saveTicketDetail(ticketId, req.body, serviceId);
    res.json({ code: 200, message: '保存成功', data: result });
  } catch (error) {
    console.error('[保存工单详情] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '保存失败' });
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

export async function serviceReply(req, res) {
  try {
    const serviceId = req.user?.userId || req.body.serviceId || '001';
    const { ticketId, content, messageType, attachment, faqSource } = req.body;
    
    if (!ticketId || !content) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    const message = await helpService.serviceReply(ticketId, serviceId, content, messageType || 'text', attachment, faqSource);
    res.json({ code: 200, message: 'success', data: message });
  } catch (error) {
    console.error('[客服回复] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '客服回复失败' });
  }
}

export async function transferTicket(req, res) {
  try {
    const fromServiceId = req.user?.userId || req.body.serviceId || '001';
    const { ticketId, toServiceId, reason } = req.body;
    
    if (!ticketId || !toServiceId) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    const result = await helpService.transferTicket(ticketId, fromServiceId, toServiceId, reason);
    res.json({ code: 200, message: '转接成功' });
  } catch (error) {
    console.error('[转接工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '转接失败' });
  }
}

export async function closeTicket(req, res) {
  try {
    const serviceId = req.user?.userId || req.body.serviceId || '001';
    const { ticketId, closeType, closeReason, solution, satisfaction, remark } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ code: 400, message: '缺少工单ID' });
    }
    
    const result = await helpService.closeTicket(ticketId, serviceId, {
      closeType,
      closeReason,
      solution,
      satisfaction,
      remark,
    });
    res.json({ code: 200, message: '工单已关闭' });
  } catch (error) {
    console.error('[关闭工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '关闭工单失败' });
  }
}

// ==================== 服务历史 ====================

export async function getUserServiceHistory(req, res) {
  try {
    const userId = req.query.userId || req.user?.userId;
    
    if (!userId) {
      return res.status(400).json({ code: 400, message: '缺少用户ID' });
    }
    
    const history = await helpService.getUserServiceHistory(userId);
    res.json({ code: 200, message: 'success', data: history });
  } catch (error) {
    console.error('[获取服务历史] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取服务历史失败' });
  }
}

// ==================== 快捷回复 ====================

export async function getQuickReplies(req, res) {
  try {
    const replies = await helpService.getQuickReplies();
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

const helpController = {
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
  getServiceWorkbench,
  
  // 工单
  createTicket,
  getTicketDetail,
  getTicketFullDetail,
  saveTicketDetail,
  sendUserMessage,
  serviceReply,
  transferTicket,
  closeTicket,
  
  // 服务历史
  getUserServiceHistory,
  
  // 快捷回复
  getQuickReplies,
  createQuickReply,
};

export default helpController;

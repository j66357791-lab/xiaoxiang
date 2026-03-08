// src/modules/help-people/help-people.controller.js
// 客服控制器

import * as helpService from './help-people.service.js';

// ==================== 用户端接口 ====================

/**
 * 用户进线 - 创建/获取工单
 * POST /api/help-people/ticket
 */
export async function createTicket(req, res) {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { userInfo, firstMessage } = req.body;
    
    if (!userId) {
      return res.status(400).json({ code: 400, message: '缺少用户ID' });
    }
    
    const result = await helpService.createTicket(userId, userInfo, firstMessage);
    
    res.json({
      code: 200,
      message: 'success',
      data: result
    });
  } catch (error) {
    console.error('[创建工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建工单失败' });
  }
}

/**
 * 获取用户的工单列表
 * GET /api/help-people/tickets
 */
export async function getUserTickets(req, res) {
  try {
    const userId = req.user?.userId || req.query.userId;
    const { page = 1, limit = 20 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ code: 400, message: '缺少用户ID' });
    }
    
    // 这里简化处理，实际可以添加更多查询逻辑
    const tickets = await helpService.getPendingTickets(parseInt(page), parseInt(limit));
    
    res.json({ code: 200, message: 'success', data: tickets });
  } catch (error) {
    console.error('[获取工单列表] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取工单列表失败' });
  }
}

/**
 * 获取工单详情
 * GET /api/help-people/ticket/:ticketId
 */
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

/**
 * 用户发送消息
 * POST /api/help-people/message
 */
export async function sendUserMessage(req, res) {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { ticketId, content, messageType, attachment } = req.body;
    
    if (!ticketId || !content) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    const result = await helpService.sendUserMessage(
      ticketId, userId, content, messageType || 'text', attachment
    );
    
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[发送消息] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '发送消息失败' });
  }
}

/**
 * 获取工单消息列表
 * GET /api/help-people/messages/:ticketId
 */
export async function getMessages(req, res) {
  try {
    const { ticketId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // 这里可以添加分页逻辑
    const result = await helpService.getTicketDetail(ticketId);
    
    res.json({ code: 200, message: 'success', data: result.messages });
  } catch (error) {
    console.error('[获取消息列表] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取消息列表失败' });
  }
}

/**
 * 标记已读
 * PUT /api/help-people/read/:ticketId
 */
export async function markAsRead(req, res) {
  try {
    const { ticketId } = req.params;
    const readerType = req.user?.role === 'admin' ? 'service' : 'user';
    
    await helpService.markAsRead(ticketId, readerType);
    res.json({ code: 200, message: 'success' });
  } catch (error) {
    console.error('[标记已读] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '标记已读失败' });
  }
}

/**
 * 提交评价
 * POST /api/help-people/rating
 */
export async function submitRating(req, res) {
  try {
    const { ticketId, score, comment } = req.body;
    
    if (!ticketId || !score) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    await helpService.submitRating(ticketId, score, comment);
    res.json({ code: 200, message: 'success' });
  } catch (error) {
    console.error('[提交评价] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '提交评价失败' });
  }
}

/**
 * 获取 FAQ 列表
 * GET /api/help-people/faq
 */
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

// ==================== 客服端接口 ====================

/**
 * 获取待处理工单列表
 * GET /api/help-people/admin/tickets
 */
export async function getPendingTickets(req, res) {
  try {
    const { page = 1, limit = 20, category, status } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    
    const result = await helpService.getPendingTickets(parseInt(page), parseInt(limit), filters);
    res.json({ code: 200, message: 'success', data: result });
  } catch (error) {
    console.error('[获取待处理工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取待处理工单失败' });
  }
}

/**
 * 客服接单
 * POST /api/help-people/admin/assign
 */
export async function assignTicket(req, res) {
  try {
    const serviceId = req.user?.userId || 'admin';
    const serviceInfo = {
      nickname: req.user?.nickname || '客服',
      avatar: req.user?.avatar || ''
    };
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ code: 400, message: '缺少工单ID' });
    }
    
    await helpService.assignTicket(ticketId, serviceId, serviceInfo);
    res.json({ code: 200, message: '接单成功' });
  } catch (error) {
    console.error('[接单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '接单失败' });
  }
}

/**
 * 客服回复
 * POST /api/help-people/admin/reply
 */
export async function serviceReply(req, res) {
  try {
    const serviceId = req.user?.userId || 'admin';
    const serviceInfo = {
      nickname: req.user?.nickname || '客服',
      avatar: req.user?.avatar || ''
    };
    const { ticketId, content, messageType, attachment } = req.body;
    
    if (!ticketId || !content) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' });
    }
    
    const message = await helpService.serviceReply(
      ticketId, serviceId, serviceInfo, content, messageType || 'text', attachment
    );
    
    res.json({ code: 200, message: 'success', data: message });
  } catch (error) {
    console.error('[客服回复] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '客服回复失败' });
  }
}

/**
 * 关闭工单
 * POST /api/help-people/admin/close
 */
export async function closeTicket(req, res) {
  try {
    const serviceId = req.user?.userId || 'admin';
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ code: 400, message: '缺少工单ID' });
    }
    
    await helpService.closeTicket(ticketId, serviceId);
    res.json({ code: 200, message: '工单已关闭' });
  } catch (error) {
    console.error('[关闭工单] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '关闭工单失败' });
  }
}

/**
 * 获取统计数据
 * GET /api/help-people/admin/statistics
 */
export async function getStatistics(req, res) {
  try {
    const stats = await helpService.getStatistics();
    res.json({ code: 200, message: 'success', data: stats });
  } catch (error) {
    console.error('[获取统计] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '获取统计数据失败' });
  }
}

/**
 * 创建 FAQ
 * POST /api/help-people/admin/faq
 */
export async function createFAQ(req, res) {
  try {
    const faq = await helpService.createFAQ(req.body);
    res.json({ code: 200, message: 'success', data: faq });
  } catch (error) {
    console.error('[创建FAQ] 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '创建FAQ失败' });
  }
}

/**
 * 更新 FAQ
 * PUT /api/help-people/admin/faq/:faqId
 */
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

/**
 * 删除 FAQ
 * DELETE /api/help-people/admin/faq/:faqId
 */
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

export default {
  createTicket,
  getUserTickets,
  getTicketDetail,
  sendUserMessage,
  getMessages,
  markAsRead,
  submitRating,
  getFAQList,
  getPendingTickets,
  assignTicket,
  serviceReply,
  closeTicket,
  getStatistics,
  createFAQ,
  updateFAQ,
  deleteFAQ
};

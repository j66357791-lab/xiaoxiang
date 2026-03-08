// src/modules/help-people/help-people.routes.js
// 客服路由

import express from 'express';
import * as controller from './help-people.controller.js';

const router = express.Router();

// ==================== 用户端路由 ====================

// 创建/获取工单（用户进线）
router.post('/ticket', controller.createTicket);

// 获取用户的工单列表
router.get('/tickets', controller.getUserTickets);

// 获取工单详情
router.get('/ticket/:ticketId', controller.getTicketDetail);

// 用户发送消息
router.post('/message', controller.sendUserMessage);

// 获取消息列表
router.get('/messages/:ticketId', controller.getMessages);

// 标记已读
router.put('/read/:ticketId', controller.markAsRead);

// 提交评价
router.post('/rating', controller.submitRating);

// 获取 FAQ 列表
router.get('/faq', controller.getFAQList);

// ==================== 客服端路由（管理后台） ====================

// 获取待处理工单列表
router.get('/admin/tickets', controller.getPendingTickets);

// 客服接单
router.post('/admin/assign', controller.assignTicket);

// 客服回复
router.post('/admin/reply', controller.serviceReply);

// 关闭工单
router.post('/admin/close', controller.closeTicket);

// 获取统计数据
router.get('/admin/statistics', controller.getStatistics);

// FAQ 管理
router.post('/admin/faq', controller.createFAQ);
router.put('/admin/faq/:faqId', controller.updateFAQ);
router.delete('/admin/faq/:faqId', controller.deleteFAQ);

export default router;

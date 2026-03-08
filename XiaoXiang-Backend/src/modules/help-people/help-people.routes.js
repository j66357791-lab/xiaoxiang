// src/modules/help-people/help-people.routes.js
// 客服路由 - 优化版

import express from 'express';
import * as controller from './help-people.controller.js';

const router = express.Router();

// ==================== 客服管理路由 ====================

// 初始化超级管理员
router.post('/admin/init', controller.initSuperAdmin);

// 客服上线
router.post('/admin/online', controller.serviceOnline);

// 客服下线
router.post('/admin/offline', controller.serviceOffline);

// 切换自动接单模式
router.post('/admin/auto-assign', controller.toggleAutoAssign);

// 获取客服工作台数据
router.get('/admin/workbench', controller.getServiceWorkbench);

// 获取需要回复的工单
router.get('/admin/need-reply', controller.getNeedReplyTickets);

// ==================== 用户端路由 ====================

// 创建/获取工单（用户进线）
router.post('/ticket', controller.createTicket);

// 获取工单详情
router.get('/ticket/:ticketId', controller.getTicketDetail);

// 用户发送消息
router.post('/message', controller.sendUserMessage);

// 获取 FAQ 列表
router.get('/faq', controller.getFAQList);

// ==================== 客服端路由 ====================

// 客服回复
router.post('/admin/reply', controller.serviceReply);

// 关闭工单
router.post('/admin/close', controller.closeTicket);

// FAQ 管理
router.post('/admin/faq', controller.createFAQ);
router.put('/admin/faq/:faqId', controller.updateFAQ);
router.delete('/admin/faq/:faqId', controller.deleteFAQ);

// 快捷回复管理
router.get('/admin/quick-replies', controller.getQuickReplies);
router.post('/admin/quick-replies', controller.createQuickReply);

// 统计数据
router.get('/admin/statistics', controller.getStatistics);

export default router;

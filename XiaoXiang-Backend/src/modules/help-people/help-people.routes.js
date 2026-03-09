// src/modules/help-people/help-people.routes.js
// 客服路由 - 规范版

import express from 'express';
import * as controller from './help-people.controller.js';

const router = express.Router();

// ==================== FAQ路由 ====================

// 获取FAQ分类列表（主FAQ）
router.get('/faq/categories', controller.getFAQCategories);

// 获取FAQ流程列表（次流程）
router.get('/faq/flows', controller.getFAQFlows);

// 获取FAQ树形结构
router.get('/faq/tree', controller.getFAQTree);

// 初始化默认FAQ数据
router.post('/faq/init', controller.initDefaultFAQ);

// 创建FAQ分类
router.post('/faq/category', controller.createFAQCategory);

// 更新FAQ分类
router.put('/faq/category/:categoryId', controller.updateFAQCategory);

// 删除FAQ分类
router.delete('/faq/category/:categoryId', controller.deleteFAQCategory);

// 创建FAQ流程
router.post('/faq/flow', controller.createFAQFlow);

// 更新FAQ流程
router.put('/faq/flow/:flowId', controller.updateFAQFlow);

// 删除FAQ流程
router.delete('/faq/flow/:flowId', controller.deleteFAQFlow);

// 使用FAQ流程回复
router.post('/faq/use', controller.useFAQFlow);

// ==================== 客服管理路由 ====================

// 初始化超级管理员
router.post('/admin/init', controller.initSuperAdmin);

// 客服上线
router.post('/admin/online', controller.serviceOnline);

// 客服下线
router.post('/admin/offline', controller.serviceOffline);

// 获取在线客服列表
router.get('/admin/online-staff', controller.getOnlineStaff);

// 获取所有客服列表（超级管理员）
router.get('/admin/all-staff', controller.getAllStaff);

// 获取客服工作台数据
router.get('/admin/workbench', controller.getServiceWorkbench);

// ==================== 工单路由 ====================

// 创建工单（用户进线）
router.post('/ticket', controller.createTicket);

// 获取工单详情
router.get('/ticket/:ticketId', controller.getTicketDetail);

// 获取工单完整详情
router.get('/ticket/:ticketId/full', controller.getTicketFullDetail);

// 保存工单详情
router.put('/ticket/:ticketId/detail', controller.saveTicketDetail);

// 用户发送消息
router.post('/message', controller.sendUserMessage);

// 客服回复
router.post('/admin/reply', controller.serviceReply);

// 转接工单
router.post('/admin/transfer', controller.transferTicket);

// 关闭工单
router.post('/admin/close', controller.closeTicket);

// ==================== 服务历史路由 ====================

// 获取用户服务历史
router.get('/service-history', controller.getUserServiceHistory);

// ==================== 快捷回复路由 ====================

// 获取快捷回复列表
router.get('/quick-replies', controller.getQuickReplies);

// 创建快捷回复
router.post('/admin/quick-reply', controller.createQuickReply);

export default router;

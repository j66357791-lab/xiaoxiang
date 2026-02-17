import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/recycle.controller.js';

const router = express.Router();

// ==================== 任务路由 ====================

// 获取开放任务（用户端，无需管理员权限）
router.get('/tasks/open', ctrl.getOpenTasks);

// 获取任务列表（管理员）
router.get('/tasks', authenticate, authorize('admin'), ctrl.getTasks);

// 发布回收任务
router.post('/tasks', authenticate, authorize('admin'), ctrl.publishTask);

// 用户接单
router.post('/tasks/:taskId/take', authenticate, ctrl.takeOrder);

// ==================== 订单路由 ====================

// 获取订单列表
router.get('/orders', authenticate, authorize('admin'), ctrl.getOrders);

// 更新订单状态
router.patch('/orders/:id/status', authenticate, authorize('admin'), ctrl.updateStatus);

// 绑定售卖信息
router.post('/orders/:id/bind', authenticate, authorize('admin'), ctrl.bindSaleInfo);

// 审核订单
router.post('/orders/:id/review', authenticate, authorize('admin'), ctrl.reviewOrder);

// 更新备注
router.patch('/orders/:id/remark', authenticate, authorize('admin'), ctrl.updateRemark);

// 确认收货
router.post('/orders/:id/receive', authenticate, authorize('admin'), ctrl.confirmReceive);

// 确认结算
router.post('/orders/:id/settle', authenticate, authorize('admin'), ctrl.confirmSettle);

export default router;

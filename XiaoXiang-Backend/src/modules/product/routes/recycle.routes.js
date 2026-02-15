import express from 'express';
import { protect, authorize } from '../../../common/middlewares/auth.js';
import * as recycleController from '../controllers/recycle.controller.js';

const router = express.Router();

// ================= 公开路由 =================
// 获取公开回收任务列表（无需登录）
router.get('/tasks/open', recycleController.getOpenTasks);

// ================= 需要权限的路由 =================
router.post('/tasks', protect, authorize('admin'), recycleController.publishTask);
router.post('/tasks/:taskId/take', protect, recycleController.takeOrder);
router.get('/orders', protect, recycleController.getOrders);
router.patch('/orders/:id/status', protect, authorize('admin'), recycleController.updateStatus);
router.post('/orders/:id/bind', protect, authorize('admin'), recycleController.bindSaleInfo);

export default router;

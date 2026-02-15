import express from 'express';
// ✅ 修正：使用 authenticate 替代 protect
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as recycleController from '../controllers/recycle.controller.js';

const router = express.Router();

// ================= 公开路由 =================
// 获取公开回收任务列表（无需登录）
router.get('/tasks/open', recycleController.getOpenTasks);

// ================= 需要权限的路由 =================
router.post('/tasks', authenticate, authorize('admin'), recycleController.publishTask);
router.post('/tasks/:taskId/take', authenticate, recycleController.takeOrder);
router.get('/orders', authenticate, recycleController.getOrders);
router.patch('/orders/:id/status', authenticate, authorize('admin'), recycleController.updateStatus);
router.post('/orders/:id/bind', authenticate, authorize('admin'), recycleController.bindSaleInfo);

export default router;

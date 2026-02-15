import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/recycle.controller.js';
const router = express.Router();

router.get('/tasks/open', ctrl.getOpenTasks); // 公开
router.post('/tasks', authenticate, authorize('admin'), ctrl.publishTask);
router.post('/tasks/:taskId/take', authenticate, ctrl.takeOrder);
router.get('/orders', authenticate, ctrl.getOrders);
router.get('/orders/export', authenticate, authorize('admin'), ctrl.exportOrders);
router.patch('/orders/:id/status', authenticate, authorize('admin'), ctrl.updateStatus);
router.post('/orders/:id/bind', authenticate, authorize('admin'), ctrl.bindSaleInfo);
export default router;

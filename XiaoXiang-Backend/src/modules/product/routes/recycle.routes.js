import express from 'express';
import { auth, authorize } from '../../../common/middlewares/auth.js';
import * as recycleController from '../controllers/recycle.controller.js';

const router = express.Router();

// 管理员发布任务
router.post('/tasks', auth, authorize('admin'), recycleController.publishTask);

// 用户接单 (模拟)
router.post('/tasks/:taskId/take', auth, recycleController.takeOrder);

// 订单管理
router.get('/orders', auth, recycleController.getOrders);
router.patch('/orders/:id/status', auth, authorize('admin'), recycleController.updateStatus);
router.post('/orders/:id/bind', auth, authorize('admin'), recycleController.bindSaleInfo);

export default router;

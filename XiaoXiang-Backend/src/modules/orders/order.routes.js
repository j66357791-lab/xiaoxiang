// src/modules/orders/order.routes.js

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { OrderController } from './order.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ==================== 用户接口 ====================
router.post('/', authenticate, asyncHandler(OrderController.createOrder));
router.get('/my', authenticate, asyncHandler(OrderController.getMyOrders));
router.get('/:id', authenticate, asyncHandler(OrderController.getOrderById));
router.post('/:id/shipping', authenticate, asyncHandler(OrderController.fillShippingInfo));
router.post('/:id/accept', authenticate, asyncHandler(OrderController.acceptQuote));
router.post('/:id/reject', authenticate, asyncHandler(OrderController.rejectQuote));
router.post('/:id/cancel', authenticate, asyncHandler(OrderController.cancelOrder));

// ==================== 管理员接口 ====================
router.get('/admin/all', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.getAllOrders));
router.patch('/:id/status', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.updateStatus));
router.post('/:id/quote', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.submitQuote));
router.post('/:id/payment', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.confirmPayment));
router.get('/admin/stats', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.getOrderStats));

export default router;

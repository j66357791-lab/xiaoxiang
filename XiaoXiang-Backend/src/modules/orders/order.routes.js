// src/modules/orders/order.routes.js
// 回收订单路由（优化版）

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { OrderController } from './order.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ==================== 用户接口 ====================

// 创建订单
router.post('/', authenticate, asyncHandler(OrderController.createOrder));

// 获取我的订单列表
router.get('/my', authenticate, asyncHandler(OrderController.getMyOrders));

// 获取订单详情
router.get('/:id', authenticate, asyncHandler(OrderController.getOrderById));

// 填写快递信息
router.post('/:id/shipping', authenticate, asyncHandler(OrderController.fillShippingInfo));

// 接受报价
router.post('/:id/accept', authenticate, asyncHandler(OrderController.acceptQuote));

// 拒绝报价
router.post('/:id/reject', authenticate, asyncHandler(OrderController.rejectQuote));

// 取消订单
router.post('/:id/cancel', authenticate, asyncHandler(OrderController.cancelOrder));

// ==================== 管理员接口 ====================

// 获取所有订单
router.get('/admin/all', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.getAllOrders));

// 获取订单统计
router.get('/admin/stats', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.getOrderStats));

// 更新订单状态
router.patch('/:id/status', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.updateStatus));

// 提交报价
router.post('/:id/quote', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.submitQuote));

// 确认打款
router.post('/:id/payment', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.confirmPayment));

// 🆕 换绑仓库
router.post('/:id/change-warehouse', authenticate, authorize('admin', 'superAdmin'), asyncHandler(OrderController.changeWarehouse));

export default router;

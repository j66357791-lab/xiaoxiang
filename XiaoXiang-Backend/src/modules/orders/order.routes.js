// src/modules/orders/order.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { OrderController } from './order.controller.js';

const router = Router();

// ==================== 用户接口 ====================

// 预生成订单号
router.get('/generate-number', authenticate, OrderController.generateOrderNumber);

// 获取我的订单列表
router.get('/my', authenticate, OrderController.getMyOrders);

// 获取我的回寄订单列表
router.get('/my/returns', authenticate, OrderController.getMyReturnOrders);

// 创建订单
router.post('/', authenticate, OrderController.createOrder);

// 提交物流信息（用户填写快递单号）
router.post('/:id/shipping', authenticate, OrderController.updateShipping);

// 接受报价
router.post('/:id/accept', authenticate, OrderController.acceptQuote);

// 拒绝报价
router.post('/:id/reject', authenticate, OrderController.rejectQuote);

// 确认回寄收货（用户）
router.post('/:id/confirm-return', authenticate, OrderController.confirmReturnReceived);

// 取消订单
router.post('/:id/cancel', authenticate, OrderController.cancelOrder);

// 获取订单详情
router.get('/:id', authenticate, OrderController.getOrderById);

// ==================== 管理员接口 ====================

// 获取所有订单（管理员）
router.get('/admin/all', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.getAllOrders
);

// 获取所有回寄订单（管理员）
router.get('/admin/returns', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.getAllReturnOrders
);

// 确认收货（管理员）
router.post('/:id/receive', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.confirmReceive
);

// 安排回寄（管理员）
router.post('/:id/arrange-return', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.arrangeReturn
);

// 确认回寄发出（管理员）
router.post('/:id/confirm-return-shipped', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.confirmReturnShipped
);

// 更新订单状态
router.patch('/:id/status', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.updateStatus
);

// 提交报价
router.post('/:id/quote', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.submitQuote
);

// 确认打款
router.post('/:id/payment', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.confirmPayment
);

export default router;

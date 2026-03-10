// src/modules/orders/order.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { OrderController } from './order.controller.js';

const router = Router();

// ==================== 用户接口 ====================

// ⚠️ 重要：具体路径必须放在 :id 参数路由之前！
// 预生成订单号
router.get('/generate-number', authenticate, OrderController.generateOrderNumber);

// 获取我的订单列表
router.get('/my', authenticate, OrderController.getMyOrders);

// 创建订单
router.post('/', authenticate, OrderController.createOrder);

// 接受报价
router.post('/:id/accept', authenticate, OrderController.acceptQuote);

// 拒绝报价
router.post('/:id/reject', authenticate, OrderController.rejectQuote);

// 取消订单
router.post('/:id/cancel', authenticate, OrderController.cancelOrder);

// ⚠️ :id 路由放在最后
// 获取订单详情
router.get('/:id', authenticate, OrderController.getOrderById);

// ==================== 管理员接口 ====================

// 获取所有订单（管理员）
router.get('/admin/all', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  OrderController.getAllOrders
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

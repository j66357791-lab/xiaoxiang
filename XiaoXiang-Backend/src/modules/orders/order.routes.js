import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { OrderController } from './order.controller.js';
import { orderValidators } from './order.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadMultiple } from '../../common/middlewares/upload.js';

const router = Router();

// 用户端接口

// 接单
router.post('/apply',
  authenticate,
  validate(orderValidators.applyJob),
  asyncHandler(OrderController.applyJob)
);

// 提交订单
router.post('/submit',
  authenticate,
  uploadMultiple('evidence', 9),
  validate(orderValidators.submitOrder),
  asyncHandler(OrderController.submitOrder)
);

// 获取我的订单
router.get('/my',
  authenticate,
  asyncHandler(OrderController.getMyOrders)
);

// 获取单个订单
router.get('/:id',
  authenticate,
  asyncHandler(OrderController.getOrderById)
);

// 取消订单
router.delete('/:id',
  authenticate,
  asyncHandler(OrderController.cancelOrder)
);

// 管理员接口

// 获取所有订单
router.get('/admin',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(OrderController.getAllOrders)
);

// 更新订单状态
router.patch('/:id/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(orderValidators.updateStatus),
  asyncHandler(OrderController.updateOrderStatus)
);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { OrderController } from './order.controller.js';
import { orderValidators } from './order.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadMultiple } from '../../common/middlewares/upload.js';

const router = Router();

// =====================
// 用户端接口
// =====================

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
  asyncHandler(OrderController.getMyOrders) // 控制器内部兼容 URL 参数
);

// =====================
// 管理员接口 (必须放在 /:id 之前)
// =====================

// 👇 修复：移动到这里，防止被 :id 拦截
router.get('/admin',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(OrderController.getAllOrders)
);

// =====================
// 通用接口
// =====================

// 获取单个订单 (必须放在 /admin 之后)
router.get('/:id',
  authenticate,
  asyncHandler(OrderController.getOrderById)
);

// 更新订单状态 (管理员)
// 注意：/:id/status 的优先级高于 /:id，因为它更具体，所以放在这里没问题
router.patch('/:id/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(orderValidators.updateStatus),
  asyncHandler(OrderController.updateOrderStatus)
);

// 取消订单
router.delete('/:id',
  authenticate,
  asyncHandler(OrderController.cancelOrder)
);

export default router;

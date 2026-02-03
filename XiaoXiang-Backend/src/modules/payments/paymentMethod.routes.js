import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { PaymentMethodController } from './paymentMethod.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadSingle } from '../../common/middlewares/upload.js';

const router = Router();

// 用户端接口

// 获取我的支付方式
router.get('/my',
  authenticate,
  asyncHandler(PaymentMethodController.getMyPaymentMethods)
);

// 提交支付方式
router.post('/bind',
  authenticate,
  uploadSingle('file'),
  asyncHandler(PaymentMethodController.bindPaymentMethod)
);

// 管理员接口

// 获取待审核的支付方式
router.get('/admin',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(PaymentMethodController.getPendingMethods)
);

// 审核支付方式
router.patch('/admin/:id/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(PaymentMethodController.auditPaymentMethod)
);

export default router;

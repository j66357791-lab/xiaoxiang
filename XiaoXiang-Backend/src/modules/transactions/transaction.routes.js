import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { TransactionController } from './transaction.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// 用户端接口

// 获取我的交易记录
router.get('/my',
  authenticate,
  asyncHandler(TransactionController.getMyTransactions)
);

// 获取用户统计数据
router.get('/stats',
  authenticate,
  asyncHandler(TransactionController.getUserStats)
);

// 管理员接口

// 获取所有交易记录
router.get('/admin/all',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(TransactionController.getAllTransactions)
);

export default router;

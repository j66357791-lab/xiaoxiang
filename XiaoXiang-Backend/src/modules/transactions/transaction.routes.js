import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { TransactionController } from './transaction.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 认证接口
// =====================

// 获取我的交易记录
router.get('/my',
  authenticate,
  asyncHandler(TransactionController.getMyTransactions)
);

// 👇 新增：获取用户统计数据
// 确保 authenticate 中间件生效，req.user 才能正确获取
router.get('/stats',
  authenticate,
  asyncHandler(TransactionController.getUserStats)
);

// =====================
// 管理员接口
// =====================

// 获取所有交易记录
router.get('/all',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(TransactionController.getAllTransactions)
);

export default router;

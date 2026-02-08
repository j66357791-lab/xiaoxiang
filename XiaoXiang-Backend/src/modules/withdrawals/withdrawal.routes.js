import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { WithdrawalController } from './withdrawal.controller.js';
import { withdrawalValidators } from './withdrawal.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 用户端接口
// =====================

// 获取我的提现记录
router.get('/my',
  authenticate,
  asyncHandler(WithdrawalController.getMyWithdrawals)
);

// 申请提现
router.post('/request',
  authenticate,
  validate(withdrawalValidators.requestWithdrawal),
  asyncHandler(WithdrawalController.requestWithdrawal)
);

// =====================
// 管理员接口
// =====================

// 获取所有提现记录 (用于后台展示)
router.get('/admin',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(WithdrawalController.getPendingWithdrawals)
);

// 审核提现 / 确认打款
router.patch('/admin/:id/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(withdrawalValidators.auditWithdrawal),
  asyncHandler(WithdrawalController.auditWithdrawal)
);

export default router;

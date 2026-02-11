import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { UserController } from './user.controller.js';
import { userValidators } from './user.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadFields } from '../../common/middlewares/upload.js';
import Transaction from '../transactions/transaction.model.js';

const router = Router();

// =====================
// 认证接口 (需要登录)
// =====================

// 获取当前用户信息
router.get('/me', authenticate, asyncHandler(UserController.getMe));

// 获取用户统计信息
router.get('/stats', authenticate, asyncHandler(UserController.getStats));

// =====================
// 团长/邀请系统路由
// =====================

// 绑定邀请人
router.post('/bind-inviter', authenticate, asyncHandler(UserController.bindInviter));

// 获取团队收益统计 (Dashboard - 今日/周/月/总)
router.get('/my-team-stats', authenticate, asyncHandler(UserController.getMyTeamStats));

// 获取团队列表 (支持搜索和直推/间推切换)
router.get('/my-team/list', authenticate, asyncHandler(UserController.getMyTeamList));

// 获取某个好友的佣金明细
router.get('/friend/:friendId/commissions', authenticate, asyncHandler(UserController.getFriendCommissions));

// 获取我的团队概要 (保留原有接口)
router.get('/my-team', authenticate, asyncHandler(UserController.getMyTeam));

// 获取我的佣金明细
router.get('/my-commissions', authenticate, asyncHandler(UserController.getMyCommissions));

// 检查升级条件
router.get('/upgrade-conditions', authenticate, asyncHandler(UserController.checkUpgradeConditions));

// =====================
// 管理员接口
// =====================

// 获取用户列表 (搜索/分页)
router.get('/list',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getUsersList)
);

// 获取单个用户详情
router.get('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getUserById)
);

// 更新 KYC 审核状态
router.patch('/:id/kyc',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateKYCStatus),
  asyncHandler(UserController.updateKYCStatus)
);

// 更新用户保证金
router.patch('/:id/deposit',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateDeposit),
  asyncHandler(UserController.updateDeposit)
);

// 禁用/启用用户
router.patch('/:id/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.toggleUserStatus)
);

export default router;

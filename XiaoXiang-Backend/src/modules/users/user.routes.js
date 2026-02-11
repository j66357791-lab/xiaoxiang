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

// 👇 新增：团长系统路由

// 绑定邀请人
router.post('/bind-inviter', authenticate, asyncHandler(UserController.bindInviter));

// 👇 新增：获取团队统计 (直推/间推人数，收益)
router.get('/my-team-stats', authMiddleware, userController.getMyTeamStats);

// 👇 新增：获取团队列表 (type=direct|indirect, keyword=search)
router.get('/my-team', authMiddleware, userController.getMyTeamList);

// 👇 新增：获取单个好友的佣金明细
router.get('/friend/:friendId/commissions', authMiddleware, userController.getFriendCommissions);

// 获取我的团队信息
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

// 获取单个用户详情 (注意：这会匹配 /admin，但没有 /admin 路由，所以是安全的，只会匹配 ID)
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

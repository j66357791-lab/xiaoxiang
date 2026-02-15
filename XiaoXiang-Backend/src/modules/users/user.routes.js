import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { UserController } from './user.controller.js';
import { userValidators } from './user.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 认证接口 (需要登录)
// =====================

// 获取当前用户信息
router.get('/me', authenticate, asyncHandler(UserController.getMe));

// 获取用户统计信息
router.get('/stats', authenticate, asyncHandler(UserController.getStats));

// =====================
// KYC 审批系统路由
// =====================

// 自动审查KYC申请
router.post('/kyc/auto-check',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.autoCheckKYC)
);

// 批量审批通过KYC
router.post('/kyc/batch-approve',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.batchApproveKYC)
);

// 批量拒绝KYC
router.post('/kyc/batch-reject',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.batchRejectKYC)
);

// 深度核验已通过的KYC
router.post('/kyc/deep-verify',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.deepVerifyKYC)
);

// =====================
// 团长/邀请系统路由
// =====================

// 绑定邀请人
router.post('/bind-inviter', authenticate, asyncHandler(UserController.bindInviter));

// 获取团队收益统计
router.get('/my-team-stats', authenticate, asyncHandler(UserController.getMyTeamStats));

// 获取团队列表
router.get('/my-team/list', authenticate, asyncHandler(UserController.getMyTeamList));

// 获取某个好友的佣金明细
router.get('/friend/:friendId/commissions', authenticate, asyncHandler(UserController.getFriendCommissions));

// 获取我的团队概要
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

// 👇👇👇 【新增】管理员更新用户信息（包括团长等级） 👇👇👇
router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.updateUser)
);
// 👆👆👆 【新增结束】👆👆👆

// 更新 KYC 审核状态
router.patch('/:id/kyc',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateKYCStatus),
  asyncHandler(UserController.updateKYCStatus)
);

// 标记用户KYC为异常
router.post('/:id/kyc/abnormal',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.markKYCAbnormal)
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

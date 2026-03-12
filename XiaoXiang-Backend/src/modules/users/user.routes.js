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

// 获取改名状态（前端轮询）
router.get('/me/name-status', authenticate, asyncHandler(UserController.getNameStatus));

// 用户修改个人资料（昵称、头像）- 排队审核机制
router.patch('/me/profile', authenticate, asyncHandler(UserController.updateMyProfile));

// 获取用户统计信息
router.get('/stats', authenticate, asyncHandler(UserController.getStats));

// 游戏积分同步接口
router.post('/me/points', authenticate, asyncHandler(UserController.updatePoints));

// =====================
// 休闲中心货币路由
// =====================

router.get('/me/leisure-currency', authenticate, asyncHandler(UserController.getLeisureCurrency));
router.post('/me/exchange/points-to-coins', authenticate, asyncHandler(UserController.exchangePointsForCoins));
router.post('/me/exchange/coins-to-points', authenticate, asyncHandler(UserController.exchangeCoinsForPoints));

// =====================
// 小象币转增路由
// =====================

router.get('/lookup', authenticate, asyncHandler(UserController.getUserByIdForTransfer));
router.post('/verify-password', authenticate, asyncHandler(UserController.verifyPassword));
router.post('/transfer-coins', authenticate, asyncHandler(UserController.transferCoins));
router.get('/transfer-history', authenticate, asyncHandler(UserController.getTransferHistory));

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

router.post('/bind-inviter', authenticate, asyncHandler(UserController.bindInviter));
router.get('/my-team-stats', authenticate, asyncHandler(UserController.getMyTeamStats));
router.get('/my-team/list', authenticate, asyncHandler(UserController.getMyTeamList));
router.get('/friend/:friendId/commissions', authenticate, asyncHandler(UserController.getFriendCommissions));
router.get('/my-team', authenticate, asyncHandler(UserController.getMyTeam));
router.get('/my-commissions', authenticate, asyncHandler(UserController.getMyCommissions));
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

// 管理员更新用户信息
router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.updateUser)
);

// 更新 KYC 审核状态（支持打回重审）
router.patch('/:id/kyc',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateKYCStatus),
  asyncHandler(UserController.updateKYCStatus)
);

// 重新核验KYC（再次调用第三方API）
router.post('/:id/kyc/reverify',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.reverifyKYC)
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

// =====================
// 休闲中心货币管理路由 (管理员)
// =====================

router.post('/:id/points/add',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.addPoints)
);

router.post('/:id/points/subtract',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.subtractPoints)
);

router.post('/:id/coins/add',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.addCoins)
);

router.post('/:id/coins/subtract',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.subtractCoins)
);

// =====================
// 审核队列管理路由 (管理员)
// =====================

// 获取审核队列状态
router.get('/admin/review-queue/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getReviewQueueStatus)
);

// 手动触发审核队列处理
router.post('/admin/review-queue/trigger',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.triggerReviewQueue)
);

export default router;

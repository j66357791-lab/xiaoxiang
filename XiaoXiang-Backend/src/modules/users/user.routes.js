/**
 * 用户路由
 * 包含：用户管理、团队管理、奖励管理等接口
 */
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

router.get('/me', authenticate, asyncHandler(UserController.getMe));
router.get('/me/name-status', authenticate, asyncHandler(UserController.getNameStatus));
router.patch('/me/profile', authenticate, asyncHandler(UserController.updateMyProfile));
router.get('/stats', authenticate, asyncHandler(UserController.getStats));
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

router.post('/kyc/auto-check',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.autoCheckKYC)
);

router.post('/kyc/batch-approve',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.batchApproveKYC)
);

router.post('/kyc/batch-reject',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.batchRejectKYC)
);

router.post('/kyc/deep-verify',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.deepVerifyKYC)
);

// =====================
// 团队/邀请系统路由
// =====================

router.post('/bind-inviter', authenticate, asyncHandler(UserController.bindInviter));
router.get('/my-team-stats', authenticate, asyncHandler(UserController.getMyTeamStats));
router.get('/my-team/list', authenticate, asyncHandler(UserController.getMyTeamList));
router.get('/friend/:friendId/commissions', authenticate, asyncHandler(UserController.getFriendCommissions));
router.get('/my-team', authenticate, asyncHandler(UserController.getMyTeam));
router.get('/my-commissions', authenticate, asyncHandler(UserController.getMyCommissions));
router.get('/upgrade-conditions', authenticate, asyncHandler(UserController.checkUpgradeConditions));
router.post('/withdraw-pending', authenticate, asyncHandler(UserController.withdrawPendingEarnings));

// =====================
// 新人奖励系统路由
// =====================

router.post('/rewards/kyc', authenticate, asyncHandler(UserController.claimKycReward));
router.post('/rewards/notification', authenticate, asyncHandler(UserController.claimNotificationReward));
router.post('/rewards/payment', authenticate, asyncHandler(UserController.claimPaymentReward));
router.post('/rewards/firstOrder', authenticate, asyncHandler(UserController.claimFirstOrderReward));
router.post('/rewards/secondOrder', authenticate, asyncHandler(UserController.claimSecondOrderReward));
router.post('/rewards/subsequent', authenticate, asyncHandler(UserController.claimSubsequentReward));
router.get('/rewards/newbie-status', authenticate, asyncHandler(UserController.getNewbieRewardStatus));

// =====================
// 管理员接口 - 团队长管理
// =====================

router.get('/admin/team-leaders',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getTeamLeaderList)
);

router.get('/admin/team-leaders/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getTeamLeaderDetail)
);

router.post('/admin/team-leaders/:id/upgrade',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.manualUpgradeRank)
);

router.post('/admin/team-leaders/:id/downgrade',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.manualDowngradeRank)
);

router.post('/admin/team-leaders/:id/recalculate',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.recalculateTeamStats)
);

// =====================
// 管理员接口 - 奖励发放
// =====================

router.get('/admin/rewards/pending',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getPendingRewards)
);

router.post('/admin/rewards/weekly',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.distributeWeeklyRewards)
);

router.post('/admin/rewards/monthly',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.distributeMonthlyRewards)
);

router.post('/admin/rewards/yearly',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.distributeYearlyRewards)
);

router.post('/admin/stats/reset',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.resetPeriodStats)
);

// =====================
// 管理员接口 - 用户管理
// =====================

router.get('/list',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getUsersList)
);

router.get('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getUserById)
);

router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.updateUser)
);

router.patch('/:id/kyc',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateKYCStatus),
  asyncHandler(UserController.updateKYCStatus)
);

router.post('/:id/kyc/reverify',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.reverifyKYC)
);

router.post('/:id/kyc/abnormal',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.markKYCAbnormal)
);

router.patch('/:id/deposit',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateDeposit),
  asyncHandler(UserController.updateDeposit)
);

router.patch('/:id/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.toggleUserStatus)
);

// =====================
// 管理员接口 - 货币管理
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
// 审核队列管理路由
// =====================

router.get('/admin/review-queue/status',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getReviewQueueStatus)
);

router.post('/admin/review-queue/trigger',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.triggerReviewQueue)
);

export default router;

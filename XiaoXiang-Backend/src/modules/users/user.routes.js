/**
 * 用户路由
 * 包含：用户管理、团队管理、奖励管理等接口
 * 
 * 接口分类说明：
 * ==================
 * 
 * 【用户接口】需要登录
 * - GET  /api/users/me - 获取当前用户信息
 * - GET  /api/users/stats - 获取用户统计
 * - POST /api/users/bind-inviter - 绑定邀请人
 * - GET  /api/users/my-team-stats - 获取团队统计
 * - GET  /api/users/my-team - 获取我的团队
 * - GET  /api/users/my-commissions - 获取佣金明细
 * - GET  /api/users/upgrade-conditions - 检查升级条件
 * - POST /api/users/withdraw-pending - 提现待提现收益
 * 
 * 【新人奖励接口】需要登录
 * - POST /api/users/rewards/kyc - 领取实名认证奖励
 * - POST /api/users/rewards/notification - 领取消息提醒奖励
 * - POST /api/users/rewards/payment - 领取绑定收款方式奖励
 * - GET  /api/users/rewards/newbie-status - 获取新人奖励状态
 * 
 * 【管理员接口】需要管理员权限
 * - GET  /api/users/admin/team-leaders - 获取团队长列表
 * - GET  /api/users/admin/team-leaders/:id - 获取团队长详情
 * - POST /api/users/admin/rewards/weekly - 发放周奖励
 * - POST /api/users/admin/rewards/monthly - 发放月奖励
 * - POST /api/users/admin/rewards/yearly - 发放年终奖励
 * - GET  /api/users/admin/rewards/pending - 获取待发放奖励
 * - POST /api/users/admin/team-leaders/:id/upgrade - 手动升级
 * - POST /api/users/admin/team-leaders/:id/downgrade - 手动降级
 * - POST /api/users/admin/team-leaders/:id/recalculate - 重新计算团队数据
 * - POST /api/users/admin/stats/reset - 重置周期统计
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

// 获取当前用户信息
router.get('/me', authenticate, asyncHandler(UserController.getMe));

// 获取改名状态
router.get('/me/name-status', authenticate, asyncHandler(UserController.getNameStatus));

// 用户修改个人资料
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

// 绑定邀请人
router.post('/bind-inviter', authenticate, asyncHandler(UserController.bindInviter));

// 获取团队统计
router.get('/my-team-stats', authenticate, asyncHandler(UserController.getMyTeamStats));

// 获取团队列表
router.get('/my-team/list', authenticate, asyncHandler(UserController.getMyTeamList));

// 获取好友佣金明细
router.get('/friend/:friendId/commissions', authenticate, asyncHandler(UserController.getFriendCommissions));

// 获取我的团队
router.get('/my-team', authenticate, asyncHandler(UserController.getMyTeam));

// 获取我的佣金明细
router.get('/my-commissions', authenticate, asyncHandler(UserController.getMyCommissions));

// 检查升级条件
router.get('/upgrade-conditions', authenticate, asyncHandler(UserController.checkUpgradeConditions));

// 提现待提现收益
router.post('/withdraw-pending', authenticate, asyncHandler(UserController.withdrawPendingEarnings));

// =====================
// 新人奖励系统路由
// =====================

// 领取实名认证奖励
router.post('/rewards/kyc', authenticate, asyncHandler(UserController.claimKycReward));

// 领取消息提醒奖励
router.post('/rewards/notification', authenticate, asyncHandler(UserController.claimNotificationReward));

// 领取绑定收款方式奖励
router.post('/rewards/payment', authenticate, asyncHandler(UserController.claimPaymentReward));

// 获取新人奖励状态
router.get('/rewards/newbie-status', authenticate, asyncHandler(UserController.getNewbieRewardStatus));

// =====================
// 管理员接口 - 团队长管理
// =====================

/**
 * [管理员] 获取团队长列表
 * @query {Number} page - 页码
 * @query {Number} limit - 每页数量
 * @query {Number} rank - 等级筛选
 * @query {String} keyword - 搜索关键词
 */
router.get('/admin/team-leaders',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getTeamLeaderList)
);

/**
 * [管理员] 获取团队长详情
 * @param {ObjectId} id - 团队长ID
 */
router.get('/admin/team-leaders/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getTeamLeaderDetail)
);

/**
 * [管理员] 手动升级团队长
 * @param {ObjectId} id - 团队长ID
 * @body {Number} newRank - 新等级
 * @body {String} reason - 原因
 */
router.post('/admin/team-leaders/:id/upgrade',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.manualUpgradeRank)
);

/**
 * [管理员] 手动降级团队长
 * @param {ObjectId} id - 团队长ID
 * @body {Number} newRank - 新等级
 * @body {String} reason - 原因
 */
router.post('/admin/team-leaders/:id/downgrade',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.manualDowngradeRank)
);

/**
 * [管理员] 重新计算团队数据
 * @param {ObjectId} id - 团队长ID
 */
router.post('/admin/team-leaders/:id/recalculate',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.recalculateTeamStats)
);

// =====================
// 管理员接口 - 奖励发放
// =====================

/**
 * [管理员] 获取待发放奖励列表
 * @query {String} type - 'weekly' | 'monthly'
 */
router.get('/admin/rewards/pending',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.getPendingRewards)
);

/**
 * [管理员] 发放周奖励
 * @body {ObjectId} leaderId - 团队长ID（可选，不传则发放所有）
 * @body {Boolean} dryRun - 是否为预览模式
 */
router.post('/admin/rewards/weekly',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.distributeWeeklyRewards)
);

/**
 * [管理员] 发放月奖励
 * @body {ObjectId} leaderId - 团队长ID（可选）
 * @body {Boolean} dryRun - 是否为预览模式
 */
router.post('/admin/rewards/monthly',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.distributeMonthlyRewards)
);

/**
 * [管理员] 发放年终奖励
 * @body {Array} rewards - 奖励列表 [{ leaderId, amount }]
 * @body {Boolean} dryRun - 是否为预览模式
 */
router.post('/admin/rewards/yearly',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.distributeYearlyRewards)
);

/**
 * [管理员] 重置周期统计
 * @body {String} type - 'weekly' | 'monthly'
 */
router.post('/admin/stats/reset',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(UserController.resetPeriodStats)
);

// =====================
// 管理员接口 - 用户管理
// =====================

// 获取用户列表
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

// 更新 KYC 审核状态
router.patch('/:id/kyc',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(userValidators.updateKYCStatus),
  asyncHandler(UserController.updateKYCStatus)
);

// 重新核验KYC
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

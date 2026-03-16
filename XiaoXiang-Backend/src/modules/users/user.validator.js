/**
 * 用户验证器
 * 包含：用户管理、团队管理、奖励管理等接口的参数验证
 */
import { body, param, query } from 'express-validator';

export const userValidators = {
  // ==================== 基础用户验证 ====================

  updateKYCStatus: [
    param('id').isMongoId().withMessage('无效的用户ID'),
    body('status').isIn(['Unverified', 'Pending', 'Verified', 'Rejected']).withMessage('无效的状态'),
  ],

  updateDeposit: [
    param('id').isMongoId().withMessage('无效的用户ID'),
    body('amount').isFloat({ min: 0 }).withMessage('金额必须大于等于0'),
  ],

  // ==================== 团队验证 ====================

  bindInviter: [
    body('inviterId').isMongoId().withMessage('无效的邀请人ID'),
  ],

  // ==================== 新人奖励验证 ====================

  claimReward: [
    // 无需额外参数，用户ID从token获取
  ],

  // ==================== 管理员验证 - 团队长管理 ====================

  upgradeRank: [
    param('id').isMongoId().withMessage('无效的团队长ID'),
    body('newRank').isInt({ min: 1, max: 5 }).withMessage('等级必须在1-5之间'),
    body('reason').optional().isString().withMessage('原因必须是字符串'),
  ],

  downgradeRank: [
    param('id').isMongoId().withMessage('无效的团队长ID'),
    body('newRank').isInt({ min: 1, max: 5 }).withMessage('等级必须在1-5之间'),
    body('reason').optional().isString().withMessage('原因必须是字符串'),
  ],

  // ==================== 管理员验证 - 奖励发放 ====================

  distributeWeekly: [
    body('leaderId').optional().isMongoId().withMessage('无效的团队长ID'),
    body('dryRun').optional().isBoolean().withMessage('dryRun必须是布尔值'),
  ],

  distributeMonthly: [
    body('leaderId').optional().isMongoId().withMessage('无效的团队长ID'),
    body('dryRun').optional().isBoolean().withMessage('dryRun必须是布尔值'),
  ],

  distributeYearly: [
    body('rewards').isArray({ min: 1 }).withMessage('奖励列表不能为空'),
    body('rewards.*.leaderId').isMongoId().withMessage('无效的团队长ID'),
    body('rewards.*.amount').isFloat({ min: 0.01 }).withMessage('金额必须大于0'),
    body('dryRun').optional().isBoolean().withMessage('dryRun必须是布尔值'),
  ],

  resetStats: [
    body('type').isIn(['weekly', 'monthly']).withMessage('类型必须是weekly或monthly'),
  ],

  // ==================== 分页查询验证 ====================

  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  ],
};

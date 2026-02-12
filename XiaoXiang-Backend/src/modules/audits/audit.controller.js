import { success, error } from '../../common/utils/response.js';
import { AuditService } from './audit.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class AuditController {
  /**
   * 申请升级
   */
  static applyUpgrade = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { targetRank } = req.body;

    if (!targetRank) {
      return error(res, '请提供目标等级', 400);
    }

    const audit = await AuditService.createUpgradeApplication(userId, targetRank);
    return success(res, audit, '升级申请已提交，等待审核');
  });

  /**
   * 自动升级（1-3级）
   */
  static autoUpgrade = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { targetRank } = req.body;

    if (!targetRank) {
      return error(res, '请提供目标等级', 400);
    }

    const user = await AuditService.autoUpgrade(userId, targetRank);
    return success(res, user, '升级成功');
  });

  /**
   * 获取我的审核状态
   */
  static getMyAuditStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const audit = await AuditService.getUserPendingAudit(userId);
    return success(res, audit || { status: 'none' }, '获取审核状态成功');
  });

  /**
   * 管理员：获取待审核列表
   */
  static getPendingAudits = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await AuditService.getAllPendingAudits(page, limit);
    return success(res, result, '获取待审核列表成功');
  });

  /**
   * 管理员：审核申请
   */
  static reviewAudit = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;
    const reviewerId = req.user._id;

    if (!['approved', 'rejected'].includes(status)) {
      return error(res, '无效的审核状态', 400);
    }

    const audit = await AuditService.reviewAudit(id, status, reviewerId, reason);
    return success(res, audit, status === 'approved' ? '审核通过' : '审核驳回');
  });
}

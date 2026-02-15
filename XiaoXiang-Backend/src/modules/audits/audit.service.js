import Audit from './audit.model.js';
import User from '../users/user.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class AuditService {
  /**
   * 创建升级申请
   */
  static async createUpgradeApplication(userId, targetRank) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    // 验证目标等级
    if (targetRank < 1 || targetRank > 5) {
      throw new BadRequestError('无效的目标等级');
    }

    // 检查是否已有待审核申请
    const existingPending = await Audit.findOne({
      userId,
      status: 'pending'
    });

    if (existingPending) {
      throw new BadRequestError('您已有待审核的升级申请，请等待审核');
    }

    // 验证人数条件
    const isValid = await this.validateRankConditions(user, targetRank);
    if (!isValid.valid) {
      throw new BadRequestError(isValid.message);
    }

    // 创建审核记录
    const audit = await Audit.create({
      userId,
      currentRank: user.agentRank,
      targetRank,
      validDirectCount: user.validDirectCount,
      validTeamCount: user.validTeamCount,
      status: 'pending'
    });

    return audit;
  }

  /**
   * 验证等级条件
   */
  static async validateRankConditions(user, targetRank) {
    const { validDirectCount, validTeamCount, agentRank } = user;

    // 不能跨级升级
    if (targetRank !== agentRank + 1) {
      return { valid: false, message: '只能逐级升级' };
    }

    switch (targetRank) {
      case 2:
        if (validTeamCount < 100) {
          return { valid: false, message: `团队有效人数不足100人，当前${validTeamCount}人` };
        }
        break;
      case 3:
        if (validTeamCount < 1000) {
          return { valid: false, message: `团队有效人数不足1000人，当前${validTeamCount}人` };
        }
        break;
      case 4:
        if (validTeamCount < 5000) {
          return { valid: false, message: `团队有效人数不足5000人，当前${validTeamCount}人` };
        }
        break;
      case 5:
        if (validDirectCount < 10000) {
          return { valid: false, message: `直推有效人数不足10000人，当前${validDirectCount}人` };
        }
        if (validTeamCount < 50000) {
          return { valid: false, message: `团队有效人数不足50000人，当前${validTeamCount}人` };
        }
        break;
      default:
        return { valid: false, message: '无效的目标等级' };
    }

    return { valid: true };
  }

  /**
   * 获取用户待审核申请
   */
  static async getUserPendingAudit(userId) {
    return await Audit.findOne({
      userId,
      status: 'pending'
    }).populate('userId', 'email');
  }

  /**
   * 管理员获取所有待审核申请
   */
  static async getAllPendingAudits(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const audits = await Audit.find({ status: 'pending' })
      .populate('userId', 'email balance')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Audit.countDocuments({ status: 'pending' });

    return {
      audits,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }

  /**
   * 管理员审核申请
   */
  static async reviewAudit(auditId, status, reviewerId, reason = '') {
    const audit = await Audit.findById(auditId).populate('userId');
    if (!audit) throw new NotFoundError('审核记录不存在');

    if (audit.status !== 'pending') {
      throw new BadRequestError('该申请已被审核');
    }

    audit.status = status;
    audit.reviewedBy = reviewerId;
    audit.reviewedAt = new Date();
    audit.reason = reason;

    await audit.save();

    // 如果审核通过，升级用户等级
    if (status === 'approved') {
      const user = await User.findById(audit.userId._id);
      user.agentRank = audit.targetRank;
      await user.save();
    }

    return audit;
  }

  /**
   * 自动升级（1-3级）
   */
  static async autoUpgrade(userId, targetRank) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    const isValid = await this.validateRankConditions(user, targetRank);
    if (!isValid.valid) {
      throw new BadRequestError(isValid.message);
    }

    user.agentRank = targetRank;
    await user.save();

    return user;
  }
}

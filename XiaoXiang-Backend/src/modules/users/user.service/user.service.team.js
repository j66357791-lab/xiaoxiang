/**
 * 用户服务 - 团队模块
 * 包含：邀请绑定、团队统计、佣金等方法
 */
import User from '../user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';
import mongoose from 'mongoose';

export class UserServiceTeam {
  /**
   * 绑定邀请人 (并发安全版)
   */
  static async bindInviter(userId, inviterId) {
    if (!inviterId) throw new BadRequestError('请提供邀请人ID');
    if (userId.toString() === inviterId.toString()) throw new BadRequestError('不能绑定自己');

    const inviter = await User.findById(inviterId);
    if (!inviter) throw new NotFoundError('邀请人不存在');
    if (!inviter.isActive) throw new BadRequestError('邀请人账号已被禁用');

    const hasLoop = await this.checkInviterLoop(userId, inviterId);
    if (hasLoop) {
      throw new BadRequestError('绑定失败：该用户是您的下级，不能形成闭环关系');
    }

    const result = await User.findOneAndUpdate(
      { 
        _id: userId, 
        inviterId: { $exists: false } 
      },
      { 
        $set: { inviterId: inviterId } 
      },
      { 
        new: true,
        runValidators: true
      }
    );

    if (!result) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      throw new ConflictError('您已经绑定过邀请人了，请勿重复操作');
    }

    clearCache('/api/users/profile');
    console.log(`[UserService] 用户 ${userId} 成功绑定邀请人 ${inviterId}`);
    return result;
  }

  /**
   * 辅助函数：检测邀请关系闭环
   */
  static async checkInviterLoop(currentUserId, targetInviterId) {
    let currentCheckingUser = await User.findById(targetInviterId);
    const maxDepth = 50; 
    let depth = 0;

    while (currentCheckingUser && depth < maxDepth) {
      if (currentCheckingUser._id.toString() === currentUserId.toString()) {
        return true;
      }

      if (currentCheckingUser.inviterId) {
        currentCheckingUser = await User.findById(currentCheckingUser.inviterId);
        depth++;
      } else {
        break;
      }
    }
    return false;
  }

  /**
   * 获取团队统计数据
   */
  static async getTeamStats(userId) {
    const commissions = await Transaction.find({
      userId: userId,
      type: 'commission'
    }).sort({ createdAt: -1 });

    let total = 0;
    let daily = 0;
    let weekly = 0;
    let monthly = 0;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    commissions.forEach(t => {
      const amount = t.amount || 0;
      const date = t.createdAt;
      total += amount;
      if (date >= startOfDay) daily += amount;
      if (date >= startOfWeek) weekly += amount;
      if (date >= startOfMonth) monthly += amount;
    });

    const directCount = await User.countDocuments({ 
      inviterId: userId, 
      isValidMember: true 
    });
    
    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);
    
    const indirectCount = await User.countDocuments({ 
      inviterId: { $in: directIds },
      isValidMember: true 
    });

    return {
      totalIncome: total,
      dailyIncome: daily,
      weeklyIncome: weekly,
      monthlyIncome: monthly,
      directCount,
      indirectCount
    };
  }

  /**
   * 获取团队列表
   */
  static async getTeamList(userId, type, keyword) {
    let users = [];
    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);

    const selectFields = 'name email avatar createdAt balance isValidMember kycStatus';

    if (type === 'direct') {
      users = await User.find({
        inviterId: userId,
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } }
        ]
      }).select(selectFields);
    } else {
      users = await User.find({
        inviterId: { $in: directIds },
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } }
        ]
      }).select(selectFields);
    }

    const usersWithCommission = await Promise.all(
      users.map(async (u) => {
        const totalCommission = await Transaction.aggregate([
          { 
            $match: { 
              userId: new mongoose.Types.ObjectId(userId), 
              type: 'commission',
              description: { $regex: u.email, $options: 'i' }
            } 
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        return {
          ...u.toObject(),
          totalCommission: totalCommission[0] ? totalCommission[0].total : 0
        };
      })
    );

    return usersWithCommission;
  }

  /**
   * 获取好友佣金明细
   */
  static async getFriendCommissions(userId, friendId) {
    const friend = await User.findById(friendId).select('email');
    if (!friend) throw new NotFoundError('好友不存在');

    const details = await Transaction.find({
      userId: userId,
      type: 'commission',
      description: { $regex: friend.email, $options: 'i' }
    }).sort({ createdAt: -1 });

    return details;
  }

  /**
   * 获取我的团队信息
   */
  static async getMyTeam(userId) {
    const members = await User.find({ inviterId: userId })
      .select('email balance isValidMember createdAt agentRank')
      .sort({ createdAt: -1 });

    const totalDirect = members.length;
    const validDirect = members.filter(m => m.isValidMember).length;

    return {
      totalDirect,
      validDirect,
      members
    };
  }

  /**
   * 获取我的佣金明细
   */
  static async getMyCommissions(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find({
      userId,
      type: 'commission'
    })
      .populate('orderId', 'orderNumber jobSnapshot.amount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({
      userId,
      type: 'commission'
    });

    return {
      transactions,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }

  /**
   * 检查升级条件
   */
  static async checkUpgradeConditions(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    const currentRank = user.agentRank || 1;
    const { validDirectCount, validTeamCount } = user;

    const RANK_CONFIG = {
      1: { name: '一级团长', nextRank: 2, needTeam: 100, needDirect: 0 },
      2: { name: '二级团长', nextRank: 3, needTeam: 1000, needDirect: 0 },
      3: { name: '三级团长', nextRank: 4, needTeam: 10000, needDirect: 5000 },
      4: { name: '四级团长', nextRank: 5, needTeam: 50000, needDirect: 30000 },
      5: { name: '五级团长', nextRank: null, needTeam: null, needDirect: null }
    };

    const currentConfig = RANK_CONFIG[currentRank] || RANK_CONFIG[1];
    const nextConfig = RANK_CONFIG[currentRank + 1];

    if (!nextConfig) {
      return {
        currentRank,
        currentRankName: currentConfig.name,
        message: '您已达到最高等级',
        canUpgrade: false
      };
    }

    const isTeamOk = validTeamCount >= nextConfig.needTeam;
    const isDirectOk = validDirectCount >= nextConfig.needDirect;
    const canUpgrade = isTeamOk && isDirectOk;

    return {
      currentRank,
      currentRankName: currentConfig.name,
      validDirectCount,
      validTeamCount,
      nextRank: nextConfig.nextRank,
      nextRankName: nextConfig.name,
      requirements: {
        needTeam: nextConfig.needTeam,
        needDirect: nextConfig.needDirect
      },
      progress: {
        teamProgress: `${validTeamCount}/${nextConfig.needTeam}`,
        directProgress: `${validDirectCount}/${nextConfig.needDirect}`,
        teamPercent: Math.min(100, Math.round((validTeamCount / nextConfig.needTeam) * 100)),
        directPercent: Math.min(100, Math.round((validDirectCount / nextConfig.needDirect) * 100))
      },
      canUpgrade,
      upgradeType: currentRank < 3 ? 'auto' : 'manual'
    };
  }

  /**
   * 执行团长升级
   */
  static async upgradeAgentRank(userId) {
    const conditions = await this.checkUpgradeConditions(userId);

    if (!conditions.canUpgrade) {
      throw new BadRequestError('未满足升级条件，无法升级');
    }

    if (conditions.upgradeType === 'auto') {
      const user = await User.findById(userId);
      if (!user) throw new NotFoundError('用户不存在');
      
      user.agentRank = conditions.nextRank;
      await user.save();
      clearCache('/api/users/profile');
      return { success: true, newRank: conditions.nextRank, message: `恭喜您成功升级为 ${conditions.nextRankName}！` };
    } else {
      throw new BadRequestError('高级团长需人工审核，请联系管理员');
    }
  }

  /**
   * 处理订单完成后的佣金计算与人数更新
   */
  static async processOrderCommission(workerId, orderId, orderAmount) {
    const worker = await User.findById(workerId);
    if (!worker) return;
    if (!worker.inviterId) return;

    const isOrderQualified = orderAmount >= 1.0;
    const justBecameValid = !worker.isValidMember && 
                            worker.kycStatus === 'Verified' && 
                            isOrderQualified;

    if (justBecameValid) {
      worker.isValidMember = true;
      await worker.save();
      await this.updateAncestorTeamCount(workerId);
      console.log(`[Commission] 用户 ${worker.email} 刚成为有效好友，暂不发放佣金。`);
      return;
    }

    if (worker.isValidMember) {
      let currentLevel = 0;
      let currentAncestorId = worker.inviterId;

      while (currentAncestorId && currentLevel < 2) {
        const ancestor = await User.findById(currentAncestorId);
        if (!ancestor) break;

        const rates = this.getCommissionRates(ancestor.agentRank || 1);
        const percentage = currentLevel === 0 ? rates.direct : rates.indirect;
        
        const rawAmount = orderAmount * percentage;
        const finalAmount = Math.round(rawAmount * 100) / 100;

        if (finalAmount >= 0.01) {
          const desc = currentLevel === 0 ? '直推佣金收益' : '间推佣金收益';
          await this.addCommission(ancestor._id, finalAmount, orderId, desc);
        }

        currentAncestorId = ancestor.inviterId;
        currentLevel++;
      }
    }
  }

  /**
   * 级联更新上级团队人数
   */
  static async updateAncestorTeamCount(newValidUserId) {
    let currentUserId = newValidUserId;
    let level = 0;

    while (currentUserId) {
      const ancestor = await User.findById(currentUserId);
      if (!ancestor || !ancestor.inviterId) break;
      const inviter = await User.findById(ancestor.inviterId);
      if (!inviter) break;

      if (level === 0) {
        inviter.validDirectCount += 1;
        inviter.validTeamCount += 1;
      } else {
        inviter.validTeamCount += 1;
      }

      await inviter.save();
      currentUserId = inviter._id;
      level++;
    }
  }

  /**
   * 获取佣金比例配置
   */
  static getCommissionRates(rank) {
    if (rank <= 1) return { direct: 0.08, indirect: 0.04 };
    if (rank === 2) return { direct: 0.10, indirect: 0.04 };
    if (rank === 3) return { direct: 0.12, indirect: 0.05 };
    if (rank === 4) return { direct: 0.14, indirect: 0.06 };
    if (rank === 5) return { direct: 0.20, indirect: 0.10 };
    return { direct: 0.08, indirect: 0.04 };
  }

  /**
   * 增加佣金余额
   */
  static async addCommission(userId, amount, orderId, description) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: amount } },
      { new: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    await Transaction.create({
      userId: user._id,
      orderId,
      type: 'commission',
      amount,
      balanceSnapshot: user.balance,
      description,
      status: 'completed'
    });

    console.log(`[Commission] 发放成功: 用户ID ${userId}, 金额 +¥${amount}, 描述: ${description}`);
    return user;
  }
}

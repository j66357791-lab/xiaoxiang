import User from './user.model.js';
import Transaction from '../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/error.js';
import { TRANSACTION_TYPE, KYC_STATUS } from '../../common/config/constants.js';
import mongoose from 'mongoose';
import { clearCache } from '../../common/middlewares/cache.js';

export class UserService {
  /**
   * 根据 ID 查找用户
   */
  static async findById(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    return user;
  }

  /**
   * 根据 Email 查找用户
   */
  static async findByEmail(email) {
    const user = await User.findOne({ email });
    return user;
  }

  /**
   * 注册用户
   */
  static async register(email, password) {
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new ConflictError('该邮箱已被注册');

    const user = await User.create({ email, password });
    return user;
  }

  /**
   * 登录验证
   */
  static async login(email, password) {
    const user = await User.findOne({ email, isActive: true });
    if (!user) throw new BadRequestError('邮箱或密码错误');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new BadRequestError('邮箱或密码错误');

    await user.updateLastLogin();
    return user;
  }

  /**
   * 增加余额 (原子操作，安全)
   */
  static async addBalance(userId, amount, orderId = null, description = '余额变动') {
    if (amount <= 0) throw new BadRequestError('金额必须大于0');

    const user = await User.findByIdAndUpdate(
      userId, 
      { $inc: { balance: amount } },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    await Transaction.create({
      userId: user._id,
      orderId,
      type: TRANSACTION_TYPE.INCOME,
      amount,
      balanceSnapshot: user.balance,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 余额增加成功: 用户 ${user.email}, +¥${amount}`);
    return user;
  }

  /**
   * 扣除余额 (已升级：高并发安全 + 绝对防止负数)
   */
  static async subtractBalance(userId, amount, description = '余额扣除') {
    if (amount <= 0) throw new BadRequestError('金额必须大于0');

    const user = await User.findOneAndUpdate(
      { 
        _id: userId,
        balance: { $gte: amount } 
      },
      { 
        $inc: { balance: -amount } 
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      console.warn(`[Security Warning] 用户 ${userId} 尝试扣款 ¥${amount} 失败：余额不足`);
      throw new BadRequestError('余额不足，无法执行此操作');
    }

    await Transaction.create({
      userId: user._id,
      type: TRANSACTION_TYPE.WITHDRAW,
      amount,
      balanceSnapshot: user.balance,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 增加经验值和信誉分
   */
  static async addExpAndCredit(userId, orderAmount, creditDelta = 1) {
    const user = await this.findById(userId);
    const expGain = 2 + (Number(orderAmount) || 0);
    user.exp += expGain;
    user.creditScore = Math.min(100, user.creditScore + creditDelta);
    user.level = this.calculateLevel(user.exp);

    await user.save();
    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 修改信誉分并处理封禁
   */
  static async modifyCreditScore(userId, delta) {
    const user = await this.findById(userId);
    
    user.creditScore += delta;
    if (user.creditScore > 100) user.creditScore = 100;
    
    if (delta < 0) {
      let banHours = 0;
      if (user.creditScore < 60) banHours = 24;
      if (user.creditScore < 40) banHours = 72;
      if (user.creditScore < 20) banHours = 720;
      if (user.creditScore <= 0) banHours = 365 * 24;

      if (banHours > 0) {
        const banDurationMs = banHours * 60 * 60 * 1000;
        const now = new Date();
        const currentBanEnd = user.creditBanUntil ? new Date(user.creditBanUntil) : now;
        const newBanEndTime = Math.max(now.getTime(), currentBanEnd.getTime()) + banDurationMs;
        user.creditBanUntil = new Date(newBanEndTime);
      }
    }

    await user.save();
    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 根据 exp 计算等级
   */
  static calculateLevel(exp) {
    if (exp >= 150) return 'Lv3';
    if (exp >= 50) return 'Lv2';
    return 'Lv1';
  }

  /**
   * 购买 VIP
   */
  static async purchaseVip(userId, tier, days) {
    const user = await this.findById(userId);
    const now = new Date();

    let newLevel = 'none';
    if (tier === 'monthly' || tier === 'monthly_luxury') newLevel = 'monthly';
    if (tier === 'semi_annual' || tier === 'semi_annual_luxury') newLevel = 'semi-annual';
    if (tier === 'annual' || tier === 'annual_luxury') newLevel = 'annual';

    let newExpireAt = now;
    if (user.vipExpireAt && user.vipExpireAt > now) {
      newExpireAt = new Date(user.vipExpireAt.getTime() + (days * 24 * 60 * 60 * 1000));
    } else {
      newExpireAt = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    }

    user.vipLevel = newLevel;
    user.vipExpireAt = newExpireAt;
    
    await user.save();
    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 更新用户保证金
   */
  static async updateDeposit(userId, amount) {
    if (amount < 0) throw new BadRequestError('保证金不能为负数');

    const user = await this.findById(userId);
    user.deposit = Number(amount);
    await user.save();
    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 提交实名认证
   */
  static async submitKYC(userId, idCard, idCardFront, idCardBack) {
    const user = await this.findById(userId);
    
    user.idCard = idCard;
    user.idCardFront = idCardFront;
    user.idCardBack = idCardBack;
    user.kycStatus = KYC_STATUS.PENDING;
    
    await user.save();
    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 更新 KYC 审核状态
   */
  static async updateKYCStatus(userId, status) {
    const validStatuses = [KYC_STATUS.VERIFIED, KYC_STATUS.REJECTED];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的审核状态');
    }

    const user = await this.findById(userId);
    user.kycStatus = status;
    await user.save();
    clearCache('/api/users/profile');
    return user;
  }

  /**
   * 自动审查KYC申请
   */
  static async autoCheckKYC(userIds) {
    let passed = 0;
    let abnormal = 0;
    let manual = 0;
    const abnormalUsers = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user || user.kycStatus !== 'Pending') continue;

        const idCard = user.idCard || '';
        let isAbnormal = false;
        let abnormalReason = '';

        const idCardValid = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard);
        if (!idCardValid) {
          isAbnormal = true;
          abnormalReason = '身份证号格式不正确';
        }

        if (!isAbnormal && idCard) {
          const duplicate = await User.findOne({
            _id: { $ne: userId },
            idCard: idCard,
            kycStatus: { $in: ['Pending', 'Verified'] }
          });
          if (duplicate) {
            isAbnormal = true;
            abnormalReason = '身份证号已被其他用户使用';
          }
        }

        if (isAbnormal) {
          user.kycStatus = 'Rejected';
          user.abnormalReason = abnormalReason;
          await user.save();
          abnormal++;
          abnormalUsers.push({ userId, reason: abnormalReason });
        } else {
          manual++;
        }
      } catch (e) {
        console.error(`[KYC AutoCheck] 用户 ${userId} 审查失败:`, e.message);
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC AutoCheck] 完成: 通过=${passed}, 异常=${abnormal}, 待人工=${manual}`);

    return {
      passed,
      abnormal,
      manual,
      abnormalUsers
    };
  }

  /**
   * 批量审批通过KYC
   */
  static async batchApproveKYC(userIds) {
    let passed = 0;
    const failed = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          failed.push({ userId, reason: '用户不存在' });
          continue;
        }
        if (user.kycStatus !== 'Pending') {
          failed.push({ userId, reason: '状态不是待审核' });
          continue;
        }

        user.kycStatus = KYC_STATUS.VERIFIED;
        await user.save();
        passed++;
      } catch (e) {
        failed.push({ userId, reason: e.message });
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC BatchApprove] 完成: 通过=${passed}, 失败=${failed.length}`);

    return { passed, failed };
  }

  /**
   * 批量拒绝KYC
   */
  static async batchRejectKYC(userIds) {
    let rejected = 0;
    const failed = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          failed.push({ userId, reason: '用户不存在' });
          continue;
        }

        user.kycStatus = KYC_STATUS.REJECTED;
        await user.save();
        rejected++;
      } catch (e) {
        failed.push({ userId, reason: e.message });
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC BatchReject] 完成: 拒绝=${rejected}, 失败=${failed.length}`);

    return { rejected, failed };
  }

  /**
   * 深度核验已通过的KYC
   */
  static async deepVerifyKYC() {
    let normal = 0;
    let abnormal = 0;
    const abnormalUsers = [];

    const verifiedUsers = await User.find({ kycStatus: 'Verified' });

    for (const user of verifiedUsers) {
      let isAbnormal = false;
      let abnormalReason = '';

      if (!user.idCard) {
        isAbnormal = true;
        abnormalReason = '身份证号为空';
      }

      if (!isAbnormal && (!user.idCardFront || !user.idCardBack)) {
        isAbnormal = true;
        abnormalReason = '身份证照片缺失';
      }

      if (!isAbnormal && user.idCard) {
        const duplicate = await User.findOne({
          _id: { $ne: user._id },
          idCard: user.idCard,
          kycStatus: 'Verified'
        });
        if (duplicate) {
          isAbnormal = true;
          abnormalReason = '身份证号重复使用';
        }
      }

      if (isAbnormal) {
        user.abnormalReason = abnormalReason;
        await user.save();
        abnormal++;
        abnormalUsers.push({ 
          userId: user._id, 
          email: user.email, 
          reason: abnormalReason 
        });
      } else {
        normal++;
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC DeepVerify] 完成: 正常=${normal}, 异常=${abnormal}`);

    return { normal, abnormal, abnormalUsers };
  }

  /**
   * 标记用户KYC为异常
   */
  static async markKYCAbnormal(userId, reason) {
    const user = await this.findById(userId);
    
    user.kycStatus = 'Rejected';
    user.abnormalReason = reason;
    await user.save();
    
    clearCache('/api/users/profile');
    console.log(`[KYC] 用户 ${userId} 已标记为异常: ${reason}`);
    
    return user;
  }

  /**
   * 获取用户统计数据
   */
  static async getUserStats(userId) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: TRANSACTION_TYPE.INCOME,
          createdAt: { $gte: startOfToday }
        }
      },
      {
        $group: { _id: null, total: { $sum: '$amount' } }
      }
    ]);

    const monthIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: TRANSACTION_TYPE.INCOME,
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: { _id: null, total: { $sum: '$amount' } }
      }
    ]);

    const dailyIncome = todayIncomeAgg.length > 0 ? todayIncomeAgg[0].total : 0;
    const monthlyIncome = monthIncomeAgg.length > 0 ? monthIncomeAgg[0].total : 0;

    return { dailyIncome, monthlyIncome };
  }

  /**
   * 获取用户列表（管理员）
   */
  static async getUsersList(query = {}) {
    const { search, page = 1, limit = 20 } = query;

    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    return { users, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 管理员更新用户信息
   */
  static async updateUser(userId, updateData) {
    const user = await this.findById(userId);
    
    const allowedFields = ['name', 'agentRank', 'balance', 'creditScore', 'isActive'];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'agentRank') {
          const rank = Number(updateData[field]);
          if (isNaN(rank) || rank < 1 || rank > 5) {
            throw new BadRequestError('团长等级必须在 1-5 之间');
          }
          user[field] = rank;
        } else if (field === 'balance') {
          const balance = Number(updateData[field]);
          if (isNaN(balance) || balance < 0) {
            throw new BadRequestError('余额不能为负数');
          }
          user[field] = balance;
        } else if (field === 'creditScore') {
          const score = Number(updateData[field]);
          if (isNaN(score) || score < -999 || score > 100) {
            throw new BadRequestError('信誉分必须在 -999 到 100 之间');
          }
          user[field] = score;
        } else {
          user[field] = updateData[field];
        }
      }
    }
    
    await user.save();
    clearCache('/api/users/profile');
    console.log(`[UserService] 用户 ${userId} 信息已更新:`, updateData);
    return user;
  }

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
    const user = await this.findById(userId);
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
      const user = await this.findById(userId);
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
    const worker = await this.findById(workerId);
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

  // ==========================================
  // 🆕 休闲中心货币系统 - 积分与小象币操作
  // ==========================================

  /**
   * 🆕 增加小象积分 (原子操作)
   */
  static async addPoints(userId, amount, description = '积分变动') {
    if (amount <= 0) throw new BadRequestError('积分必须大于0');

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { points: amount } },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    await Transaction.create({
      userId: user._id,
      type: 'points_income',
      amount,
      balanceSnapshot: user.points,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 积分增加成功: 用户 ${user.email}, +${amount}积分`);
    return user;
  }

  /**
   * 🆕 扣除小象积分 (高并发安全)
   */
  static async subtractPoints(userId, amount, description = '积分扣除') {
    if (amount <= 0) throw new BadRequestError('积分必须大于0');

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        points: { $gte: amount }
      },
      {
        $inc: { points: -amount }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      console.warn(`[Security Warning] 用户 ${userId} 尝试扣除 ${amount} 积分失败：积分不足`);
      throw new BadRequestError('积分不足，无法执行此操作');
    }

    await Transaction.create({
      userId: user._id,
      type: 'points_expense',
      amount,
      balanceSnapshot: user.points,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 积分扣除成功: 用户 ${user.email}, -${amount}积分`);
    return user;
  }

  /**
   * 🆕 增加小象币 (原子操作)
   */
  static async addCoins(userId, amount, description = '小象币变动') {
    if (amount <= 0) throw new BadRequestError('小象币必须大于0');

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: amount } },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    await Transaction.create({
      userId: user._id,
      type: 'coins_income',
      amount,
      balanceSnapshot: user.coins,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 小象币增加成功: 用户 ${user.email}, +${amount}币`);
    return user;
  }

  /**
   * 🆕 扣除小象币 (高并发安全)
   */
  static async subtractCoins(userId, amount, description = '小象币扣除') {
    if (amount <= 0) throw new BadRequestError('小象币必须大于0');

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        coins: { $gte: amount }
      },
      {
        $inc: { coins: -amount }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      console.warn(`[Security Warning] 用户 ${userId} 尝试扣除 ${amount} 小象币失败：小象币不足`);
      throw new BadRequestError('小象币不足，无法执行此操作');
    }

    await Transaction.create({
      userId: user._id,
      type: 'coins_expense',
      amount,
      balanceSnapshot: user.coins,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 小象币扣除成功: 用户 ${user.email}, -${amount}币`);
    return user;
  }

  /**
   * 🆕 小象币兑换积分
   */
  static async exchangeCoinsForPoints(userId, coins, pointsRate = 10) {
    if (coins <= 0) throw new BadRequestError('兑换小象币必须大于0');
    if (pointsRate <= 0) throw new BadRequestError('兑换比例无效');

    const pointsToReceive = coins * pointsRate;

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        coins: { $gte: coins }
      },
      {
        $inc: { coins: -coins, points: pointsToReceive }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      throw new BadRequestError('小象币不足');
    }

    await Transaction.create([{
      userId: user._id,
      type: 'coins_exchange',
      amount: coins,
      balanceSnapshot: user.coins,
      description: `小象币兑换积分：${coins}币 → ${pointsToReceive}积分`,
      status: 'completed'
    }, {
      userId: user._id,
      type: 'points_exchange',
      amount: pointsToReceive,
      balanceSnapshot: user.points,
      description: `小象币兑换获得：${pointsToReceive}积分`,
      status: 'completed'
    }]);

    clearCache('/api/users/profile');
    console.log(`[UserService] 小象币兑换成功: 用户 ${user.email}, ${coins}币 → ${pointsToReceive}积分`);
    return { user, coinsSpent: coins, pointsReceived: pointsToReceive };
  }

  /**
   * 🆕 积分兑换小象币
   */
  static async exchangePointsForCoins(userId, points, coinsRate = 100) {
    if (points <= 0) throw new BadRequestError('兑换积分必须大于0');
    if (coinsRate <= 0) throw new BadRequestError('兑换比例无效');

    const coinsToReceive = Math.floor(points / coinsRate);
    if (coinsToReceive <= 0) {
      throw new BadRequestError('积分不足，无法兑换');
    }

    const pointsToDeduct = coinsToReceive * coinsRate;

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        points: { $gte: pointsToDeduct }
      },
      {
        $inc: { points: -pointsToDeduct, coins: coinsToReceive }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      throw new BadRequestError('积分不足');
    }

    await Transaction.create([{
      userId: user._id,
      type: 'points_exchange',
      amount: pointsToDeduct,
      balanceSnapshot: user.points,
      description: `积分兑换小象币：${pointsToDeduct}积分 → ${coinsToReceive}币`,
      status: 'completed'
    }, {
      userId: user._id,
      type: 'coins_exchange',
      amount: coinsToReceive,
      balanceSnapshot: user.coins,
      description: `积分兑换获得：${coinsToReceive}币`,
      status: 'completed'
    }]);

    clearCache('/api/users/profile');
    console.log(`[UserService] 积分兑换成功: 用户 ${user.email}, ${pointsToDeduct}积分 → ${coinsToReceive}币`);
    return { user, pointsSpent: pointsToDeduct, coinsReceived: coinsToReceive };
  }

  // ==========================================
  // 🆕 神秘商店系统
  // ==========================================

  /**
   * 🆕 获取神秘商店进度
   */
  static async getMysteryShopProgress(userId) {
    const user = await this.findById(userId);
    return {
      level: user.mysteryShop?.level || 'novice',
      consumption: user.mysteryShop?.consumption || 0,
      totalConsumption: user.mysteryShop?.totalConsumption || 0,
      lastDrawAt: user.mysteryShop?.lastDrawAt || null
    };
  }

  /**
   * 🆕 切换神秘商店场阶（重置进度）
   */
  static async switchMysteryShopLevel(userId, level) {
    const validLevels = ['novice', 'elite', 'god'];
    if (!validLevels.includes(level)) {
      throw new BadRequestError('无效的场阶');
    }

    const user = await User.switchMysteryShopLevel(userId, level);

    if (!user) throw new NotFoundError('用户不存在');

    console.log(`[MysteryShop] 用户 ${userId} 切换到场阶 ${level}，进度已重置`);
    return {
      level: user.mysteryShop.level,
      consumption: user.mysteryShop.consumption
    };
  }

  /**
   * 🆕 增加神秘商店进度（游戏消耗时调用）
   */
  static async addMysteryShopProgress(userId, amount) {
    if (amount <= 0) return null;
    const user = await User.updateMysteryShopProgress(userId, amount);
    return user;
  }

  // ==========================================
  // 🆕 小象币转增功能
  // ==========================================

  /**
   * 🆕 小象币转增
   */
  static async transferCoins(senderId, receiverId, amount, password) {
    const sender = await this.findById(senderId);
    
    if (!sender) {
      throw new BadRequestError('发送方用户不存在');
    }
    
    // 验证密码
    const isValidPassword = sender.comparePassword(password);
    if (!isValidPassword) {
      throw new BadRequestError('密码错误');
    }
    
    // 验证接收方
    const receiver = await this.findById(receiverId);
    if (!receiver) {
      throw new BadRequestError('接收方用户不存在');
    }
    
    // 计算手续费（5%）
    const feeRate = 0.05;
    const fee = Math.ceil(amount * feeRate);
    const totalDeduct = amount + fee;
    
    // 验证余额
    if (sender.coins < totalDeduct) {
      throw new BadRequestError(`小象币不足，需要 ${totalDeduct} 个（含手续费 ${fee} 个）`);
    }
    
    // 执行转账（使用事务）
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 扣除发送方小象币
      sender.coins -= totalDeduct;
      await sender.save({ session });
      
      // 增加接收方小象币
      receiver.coins += amount;
      await receiver.save({ session });
      
      // 记录交易 - 转出
      await Transaction.create([{
        userId: senderId,
        type: 'coins_transfer_out',
        amount: amount,
        coinsSnapshot: sender.coins,
        description: `转增给 ${receiver.name || receiver.email}`,
        metadata: { receiverId, fee },
        status: 'completed'
      }], { session });
      
      // 记录交易 - 手续费
      await Transaction.create([{
        userId: senderId,
        type: 'coins_transfer_fee',
        amount: fee,
        coinsSnapshot: sender.coins,
        description: `转增手续费`,
        metadata: { receiverId, transferAmount: amount },
        status: 'completed'
      }], { session });
      
      // 记录交易 - 转入
      await Transaction.create([{
        userId: receiverId,
        type: 'coins_transfer_in',
        amount: amount,
        coinsSnapshot: receiver.coins,
        description: `收到 ${sender.name || sender.email} 的转增`,
        metadata: { senderId: senderId.toString() },
        status: 'completed'
      }], { session });
      
      await session.commitTransaction();
      
      // 🆕 发送通知给接收方（事务外执行，失败不影响转账）
      try {
        const { NotificationService } = await import('../notifications/notification.service.js');
        await NotificationService.sendTransferNotification(
          receiverId,
          sender.name || sender.email,
          amount
        );
      } catch (notifyErr) {
        console.error('[Transfer] ⚠️ 通知发送失败:', notifyErr.message);
      }
      
      console.log(`[Transfer] 💰 转增成功: ${senderId} -> ${receiverId}, 金额: ${amount}, 手续费: ${fee}`);
      
      return {
        success: true,
        transferAmount: amount,
        fee: fee,
        totalDeducted: totalDeduct,
        receiverName: receiver.name || '小象用户',
        senderBalance: sender.coins
      };
      
    } catch (err) {
      await session.abortTransaction();
      console.error('[Transfer] ❌ 转增失败:', err);
      throw new BadRequestError('转增失败，请重试');
    } finally {
      session.endSession();
    }
  }

  /**
   * 🆕 获取转增流水记录
   */
  static async getTransferHistory(userId, type = 'all', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    // 构建查询条件
    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      type: { $in: ['coins_transfer_out', 'coins_transfer_in', 'coins_transfer_fee'] }
    };
    
    // 按类型筛选
    if (type === 'out') {
      filter.type = { $in: ['coins_transfer_out', 'coins_transfer_fee'] };
    } else if (type === 'in') {
      filter.type = 'coins_transfer_in';
    }
    
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(filter)
    ]);
    
    // 统计汇总
    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), type: { $in: ['coins_transfer_out', 'coins_transfer_in', 'coins_transfer_fee'] } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const summary = {
      totalSent: 0,
      totalReceived: 0,
      totalFee: 0
    };
    
    stats.forEach(s => {
      if (s._id === 'coins_transfer_out') summary.totalSent = s.total;
      if (s._id === 'coins_transfer_in') summary.totalReceived = s.total;
      if (s._id === 'coins_transfer_fee') summary.totalFee = s.total;
    });
    
    return {
      transactions,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }
}

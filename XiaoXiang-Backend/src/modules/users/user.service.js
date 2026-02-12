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
    if (!user) throw new NotFoundError('用户不存在');
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

  // ==========================================
  // KYC 审批系统服务方法
  // ==========================================

  /**
   * 自动审查KYC申请
   * 检查：1. 身份证号位数是否正确 2. 是否有重复提交
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

        // 检查1: 身份证号位数 (18位)
        const idCardValid = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard);
        if (!idCardValid) {
          isAbnormal = true;
          abnormalReason = '身份证号格式不正确';
        }

        // 检查2: 是否有重复身份证号
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
          // 标记为异常
          user.kycStatus = 'Rejected';
          user.abnormalReason = abnormalReason;
          await user.save();
          abnormal++;
          abnormalUsers.push({ userId, reason: abnormalReason });
        } else {
          // 通过自动审查，等待人工审核
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
   * 核验数据库中的数据完整性
   */
  static async deepVerifyKYC() {
    let normal = 0;
    let abnormal = 0;
    const abnormalUsers = [];

    // 获取所有已通过实名认证的用户
    const verifiedUsers = await User.find({ kycStatus: 'Verified' });

    for (const user of verifiedUsers) {
      let isAbnormal = false;
      let abnormalReason = '';

      // 检查1: 身份证号是否为空
      if (!user.idCard) {
        isAbnormal = true;
        abnormalReason = '身份证号为空';
      }

      // 检查2: 身份证照片是否存在
      if (!isAbnormal && (!user.idCardFront || !user.idCardBack)) {
        isAbnormal = true;
        abnormalReason = '身份证照片缺失';
      }

      // 检查3: 是否有重复身份证号
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

  // ==========================================
  // 团长邀请与佣金系统逻辑
  // ==========================================

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
   * 升级规则：
   * - 一级团长：注册即获得（默认）
   * - 升级二级：团队100人
   * - 升级三级：团队1000人
   * - 升级四级：团队10000人，直推不少于5000人
   * - 升级五级：团队50000人，直推不少于30000人
   */
  static async checkUpgradeConditions(userId) {
    const user = await this.findById(userId);
    const currentRank = user.agentRank || 1;
    const { validDirectCount, validTeamCount } = user;

    // 团长等级配置
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
}

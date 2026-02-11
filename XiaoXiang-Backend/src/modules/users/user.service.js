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

    // 直接原子更新，因为加钱不需要检查上限
    const user = await User.findByIdAndUpdate(
      userId, 
      { $inc: { balance: amount } },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    // 记录流水
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

    // 👇 核心安全代码
    // 使用 findOneAndUpdate 配合查询条件 { balance: { $gte: amount } }
    // 逻辑：数据库找到该用户 且 当前余额 >= 扣款金额，才会执行扣减
    // 如果并发导致余额不足，这一步会直接返回 null，不会扣款
    const user = await User.findOneAndUpdate(
      { 
        _id: userId,
        balance: { $gte: amount } // 👈 安全锁：余额不足时拒绝更新
      },
      { 
        $inc: { balance: -amount } 
      },
      { new: true }
    );

    // 检查结果
    if (!user) {
      // 如果返回 null，只有两种情况：1. 用户不存在  2. 余额不足
      // 我们需要区分一下，给用户准确的提示
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      
      // 余额不足（最关键的安全防线）
      console.warn(`[Security Warning] 用户 ${userId} 尝试扣款 ¥${amount} 失败：余额不足或被并发扣除`);
      throw new BadRequestError('余额不足，无法执行此操作');
    }

    // 记录流水
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
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .select('idCard idCardFront idCardBack')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    return { users, total, page: parseInt(page), limit: parseInt(limit) };
  }

  // ==========================================
  // 👇 新增：团长邀请与佣金系统逻辑
  // ==========================================

  /**
   * 绑定邀请人
   */
  static async bindInviter(userId, inviterId) {
    if (!inviterId) throw new BadRequestError('请提供邀请人ID');
    if (userId.toString() === inviterId.toString()) throw new BadRequestError('不能绑定自己');

    const me = await this.findById(userId);
    if (me.inviterId) throw new ConflictError('您已经绑定过邀请人了');

    // 检查邀请人是否存在且有效
    const inviter = await User.findById(inviterId);
    if (!inviter) throw new NotFoundError('邀请人不存在');
    if (!inviter.isActive) throw new BadRequestError('邀请人账号已被禁用');

    me.inviterId = inviterId;
    await me.save();

    clearCache('/api/users/profile');
    return me;
  }

  /**
   * 获取我的团队信息 (直推列表)
   */
  static async getMyTeam(userId) {
    const members = await User.find({ inviterId: userId })
      .select('email balance isValidMember createdAt agentRank')
      .sort({ createdAt: -1 });

    // 统计数据
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
    
    // 查找类型为 'commission' 的流水
    const transactions = await Transaction.find({
      userId,
      type: 'commission'
    })
      .populate('orderId', 'orderNumber jobSnapshot.amount') // 关联订单信息
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
    const currentRank = user.agentRank || 0;
    const { validDirectCount, validTeamCount } = user;

    // 定义等级配置
    const RANK_CONFIG = {
      1: { name: '一级团长', nextRank: 2, needTeam: 100, needDirect: 0 },
      2: { name: '二级团长', nextRank: 3, needTeam: 1000, needDirect: 0 },
      3: { name: '三级团长', nextRank: 4, needTeam: 5000, needDirect: 0 },
      4: { name: '四级团长', nextRank: 5, needTeam: 50000, needDirect: 10000 },
      5: { name: '五级团长', nextRank: null, needTeam: null, needDirect: null }
    };

    const currentConfig = RANK_CONFIG[currentRank] || RANK_CONFIG[1];
    const nextConfig = RANK_CONFIG[currentRank + 1];

    if (!nextConfig) {
      return {
        currentRankName: currentConfig.name,
        message: '您已达到最高等级'
      };
    }

    const isTeamOk = validTeamCount >= nextConfig.needTeam;
    const isDirectOk = validDirectCount >= nextConfig.needDirect;
    const canUpgrade = isTeamOk && isDirectOk;

    return {
      currentRank: currentRank,
      currentRankName: currentConfig.name,
      validDirectCount,
      validTeamCount,
      nextRankName: RANK_CONFIG[currentRank + 1].name,
      requirements: {
        needTeam: nextConfig.needTeam,
        needDirect: nextConfig.needDirect
      },
      canUpgrade,
      // 1-3级自动升级，4-5级人工审核
      upgradeType: currentRank < 3 ? 'auto' : 'manual'
    };
  }

  /**
   * 【核心】处理订单完成后的佣金计算与人数更新
   * 由 OrderService 在订单状态变为 Completed 时调用
   */
  static async processOrderCommission(workerId, orderId, orderAmount) {
    // 1. 获取当前做单用户
    const worker = await this.findById(workerId);
    if (!worker.inviterId) return; // 没有上级，无需处理

    // 2. 判定“有效好友”
    // 条件：已实名 + 订单金额 >= 1元
    const isOrderQualified = orderAmount >= 1.0;
    const justBecameValid = !worker.isValidMember && 
                            worker.kycStatus === 'Verified' && 
                            isOrderQualified;

    if (justBecameValid) {
      // 标记为有效
      worker.isValidMember = true;
      await worker.save();
      
      // 级联更新所有上级的人数统计
      await this.updateAncestorTeamCount(workerId);

      // 根据需求：成为有效好友后的“后续”订单才发佣金。
      // 当前这单触发有效化，但本身不发佣金。
      console.log(`[Commission] 用户 ${worker.email} 刚成为有效好友，暂不发放佣金。`);
      return;
    }

    // 3. 如果已经是有效好友，计算并发放佣金
    if (worker.isValidMember) {
      let currentLevel = 0; // 0 = 直推, 1 = 间推
      let currentAncestorId = worker.inviterId;

      while (currentAncestorId && currentLevel < 2) {
        const ancestor = await User.findById(currentAncestorId);
        if (!ancestor) break;

        // 获取该等级的佣金比例
        const rates = this.getCommissionRates(ancestor.agentRank || 0);
        const percentage = currentLevel === 0 ? rates.direct : rates.indirect;
        
        // 计算金额
        const rawAmount = orderAmount * percentage;
        const finalAmount = Math.round(rawAmount * 100) / 100; // 保留两位小数

        // 只有金额 >= 0.01 才发放
        if (finalAmount >= 0.01) {
          const desc = currentLevel === 0 ? '直推佣金收益' : '间推佣金收益';
          await this.addCommission(ancestor._id, finalAmount, orderId, desc);
        }

        // 向上查找
        currentAncestorId = ancestor.inviterId;
        currentLevel++;
      }
    }
  }

  /**
   * 级联更新上级团队人数
   * 当下级成为有效好友时调用
   */
  static async updateAncestorTeamCount(newValidUserId) {
    let currentUserId = newValidUserId;
    let level = 0;

    // 循环向上查找，直到没有上级
    while (currentUserId) {
      const ancestor = await User.findById(currentUserId);
      if (!ancestor || !ancestor.inviterId) break;

      const inviter = await User.findById(ancestor.inviterId);
      if (!inviter) break;

      // 第一级：直推+1，团队+1
      if (level === 0) {
        inviter.validDirectCount += 1;
        inviter.validTeamCount += 1;
      } else {
        // 更上级：只有团队+1
        inviter.validTeamCount += 1;
      }

      await inviter.save();
      
      // 继续向上
      currentUserId = inviter._id;
      level++;
    }
  }

  /**
   * 获取佣金比例配置
   */
  static getCommissionRates(rank) {
    // 默认 0 级
    if (rank <= 0) return { direct: 0.08, indirect: 0.04 };
    if (rank === 1) return { direct: 0.08, indirect: 0.04 };
    if (rank === 2) return { direct: 0.10, indirect: 0.04 };
    if (rank === 3) return { direct: 0.12, indirect: 0.05 };
    if (rank === 4) return { direct: 0.14, indirect: 0.06 };
    if (rank === 5) return { direct: 0.20, indirect: 0.10 };
    return { direct: 0, indirect: 0 };
  }

  /**
   * 【私有】增加佣金余额
   * 专门用于佣金发放，原子操作
   */
  static async addCommission(userId, amount, orderId, description) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: amount } },
      { new: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    // 记录流水，类型为 'commission'
    await Transaction.create({
      userId: user._id,
      orderId,
      type: 'commission', // 这里使用字符串，确保与 Model 枚举一致
      amount,
      balanceSnapshot: user.balance,
      description,
      status: 'completed'
    });

    console.log(`[Commission] 发放成功: 用户ID ${userId}, 金额 +¥${amount}, 描述: ${description}`);
    return user;
  }
}

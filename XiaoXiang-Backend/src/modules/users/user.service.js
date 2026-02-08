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
}

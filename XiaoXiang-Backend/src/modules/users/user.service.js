import User from './user.model.js';
import Transaction from '../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/error.js';
import { TRANSACTION_TYPE, KYC_STATUS } from '../../common/config/constants.js';
import mongoose from 'mongoose'; // 新增：用于 ObjectId 转换

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
   * 增加余额
   */
  static async addBalance(userId, amount, orderId = null, description = '余额变动') {
    if (amount <= 0) throw new BadRequestError('金额必须大于0');

    const user = await this.findById(userId);
    user.balance += amount;
    await user.save();

    await Transaction.create({
      userId: user._id,
      orderId,
      type: TRANSACTION_TYPE.INCOME,
      amount,
      balanceSnapshot: user.balance,
      description,
      status: 'completed'
    });

    console.log(`[UserService] 余额变动成功: 用户 ${user.email}, 金额 ¥${amount}`);
    return user;
  }

  /**
   * 扣除余额
   */
  static async subtractBalance(userId, amount, description = '余额扣除') {
    if (amount <= 0) throw new BadRequestError('金额必须大于0');

    const user = await this.findById(userId);
    if (user.balance < amount) throw new BadRequestError('余额不足');

    user.balance -= amount;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: TRANSACTION_TYPE.WITHDRAW,
      amount,
      balanceSnapshot: user.balance,
      description,
      status: 'completed'
    });

    return user;
  }

  /**
   * 增加经验值和信誉分 (订单完成时调用)
   * 规则：经验+2+金额，信誉分+1
   */
  static async addExpAndCredit(userId, orderAmount, creditDelta = 1) {
    const user = await this.findById(userId);

    // 1. 增加经验值 (规则：每完成一单2点 + 每块钱1点)
    const expGain = 2 + (Number(orderAmount) || 0);
    user.exp += expGain;

    // 2. 增加信誉分
    user.creditScore = Math.min(100, user.creditScore + creditDelta);

    // 3. 检查是否升级
    user.level = this.calculateLevel(user.exp);

    await user.save();
    console.log(`[UserService] 用户 ${user.email} 获得 ${expGain} 经验, 信誉分 ${user.creditScore}`);
    return user;
  }

  /**
   * 修改信誉分并处理封禁 (取消订单时调用)
   * 规则：分数 < 60 -> 禁24h, < 40 -> 72h, < 20 -> 720h, <= 0 -> 365天
   * 注意：封禁时间叠加
   */
  static async modifyCreditScore(userId, delta) {
    const user = await this.findById(userId);
    
    // 1. 更新分数
    user.creditScore += delta;
    if (user.creditScore > 100) user.creditScore = 100;
    
    // 2. 封禁时间逻辑 (仅当扣分时判断)
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
        
        // 叠加逻辑：如果在封禁期，结束时间往后延；如果未封禁，从现在开始算
        const newBanEndTime = Math.max(now.getTime(), currentBanEnd.getTime()) + banDurationMs;
        
        user.creditBanUntil = new Date(newBanEndTime);
        console.log(`[UserService] 用户 ${user.email} 信誉分 ${user.creditScore}, 封禁至 ${user.creditBanUntil}`);
      }
    }

    await user.save();
    return user;
  }

  /**
   * 根据 exp 计算等级
   */
  static calculateLevel(exp) {
    if (exp >= 150) return 'Lv3'; // 略有小成
    if (exp >= 50) return 'Lv2';  // 小有所成
    return 'Lv1';                 // 初入茅庐
  }

  /**
   * 购买 VIP
   */
  static async purchaseVip(userId, tier, days) {
    const user = await this.findById(userId);
    const now = new Date();

    // 设定等级映射
    let newLevel = 'none';
    if (tier === 'monthly' || tier === 'monthly_luxury') newLevel = 'monthly';
    if (tier === 'semi_annual' || tier === 'semi_annual_luxury') newLevel = 'semi-annual';
    if (tier === 'annual' || tier === 'annual_luxury') newLevel = 'annual';

    // 计算过期时间
    let newExpireAt = now;
    if (user.vipExpireAt && user.vipExpireAt > now) {
      // 如果当前未过期，在原基础上累加
      newExpireAt = new Date(user.vipExpireAt.getTime() + (days * 24 * 60 * 60 * 1000));
    } else {
      // 如果已过期，从现在开始算
      newExpireAt = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    }

    user.vipLevel = newLevel;
    user.vipExpireAt = newExpireAt;
    
    // 如果是降级购买（比如年卡买完了买月卡，或者不同类型），这里逻辑需要根据需求调整
    // 目前假设：VIP等级仅看vipExpireAt是否大于现在，和类型。
    // 如果有"不能降级"的规则，需要在这里加 if (tier < currentTier) throw Error;

    await user.save();
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

    return user;
  }

  /**
   * 获取用户统计数据
   */
  static async getUserStats(userId) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 计算今日收入总和
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

    // 计算本月收入总和
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

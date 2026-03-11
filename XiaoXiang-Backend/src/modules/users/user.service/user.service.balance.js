/**
 * 用户服务 - 余额模块
 * 包含：余额增减、经验值、信誉分、VIP等方法
 */
import User from '../user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';
import { clearCache } from '../../common/middlewares/cache.js';

// 交易类型常量
const TRANSACTION_TYPE = {
  INCOME: 'income',
  WITHDRAW: 'withdraw'
};

export class UserServiceBalance {
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
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
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
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
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
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
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
}

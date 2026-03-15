/**
 * 用户服务 - 统计模块
 * 包含：用户统计、神秘商店等方法
 */
import User from '../user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError } from '../../../common/utils/error.js';
import mongoose from 'mongoose';

export class UserServiceStats {
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
          type: 'income',
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
          type: 'income',
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
   * 获取神秘商店进度
   */
  static async getMysteryShopProgress(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    return {
      level: user.mysteryShop?.level || 'novice',
      consumption: user.mysteryShop?.consumption || 0,
      totalConsumption: user.mysteryShop?.totalConsumption || 0,
      lastDrawAt: user.mysteryShop?.lastDrawAt || null
    };
  }

  /**
   * 切换神秘商店场阶（重置进度）
   */
  static async switchMysteryShopLevel(userId, level) {
    const validLevels = ['novice', 'elite', 'god'];
    if (!validLevels.includes(level)) {
      throw new BadRequestError('无效的场阶');
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    user.mysteryShop = user.mysteryShop || {};
    user.mysteryShop.level = level;
    user.mysteryShop.consumption = 0;
    
    await user.save();

    console.log(`[MysteryShop] 用户 ${userId} 切换到场阶 ${level}，进度已重置`);
    return {
      level: user.mysteryShop.level,
      consumption: user.mysteryShop.consumption
    };
  }

  /**
   * 增加神秘商店进度（游戏消耗时调用）
   */
  static async addMysteryShopProgress(userId, amount) {
    if (amount <= 0) return null;
    
    const user = await User.findById(userId);
    if (!user) return null;
    
    user.mysteryShop = user.mysteryShop || {};
    user.mysteryShop.consumption = (user.mysteryShop.consumption || 0) + amount;
    user.mysteryShop.totalConsumption = (user.mysteryShop.totalConsumption || 0) + amount;
    user.mysteryShop.lastDrawAt = new Date();
    
    await user.save();
    return user;
  }
}

// src/modules/wheel5600-MysteryShop/MysteryShop.service.js
import mongoose from 'mongoose';
import User from '../../users/user.model.js';
import MysteryShopLog from './MysteryShop.models.js';
import Transaction from '../../transactions/transaction.model.js';
import Jackpot from '../../WheelGame/Jackpot.models.js';
import { 
  MYSTERY_SHOP_THRESHOLDS, 
  REWARDS_CONFIG, 
  LEVEL_NAMES,
  getTotalWeight 
} from './MysteryShop.config.js';
import { NotFoundError, BadRequestError } from '../../../common/utils/error.js';

export class MysteryShopService {
  
  /**
   * 获取神秘商店状态
   */
  static async getShopStatus(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    const level = user.mysteryShop?.level || 'novice';
    const consumption = user.mysteryShop?.consumption || 0;
    const totalConsumption = user.mysteryShop?.totalConsumption || 0;
    const threshold = MYSTERY_SHOP_THRESHOLDS[level];
    const progress = Math.min(100, (consumption / threshold) * 100);
    const canDraw = consumption >= threshold;

    return {
      level,
      levelName: LEVEL_NAMES[level],
      consumption,
      totalConsumption,
      threshold,
      progress: Math.round(progress * 100) / 100,
      canDraw,
      lastDrawAt: user.mysteryShop?.lastDrawAt || null
    };
  }

  /**
   * 切换场阶（重置进度）
   */
  static async switchLevel(userId, targetLevel) {
    const validLevels = ['novice', 'elite', 'god'];
    if (!validLevels.includes(targetLevel)) {
      throw new BadRequestError('无效的场阶');
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    const currentLevel = user.mysteryShop?.level || 'novice';
    const currentConsumption = user.mysteryShop?.consumption || 0;
    const currentThreshold = MYSTERY_SHOP_THRESHOLDS[currentLevel];

    // 如果当前进度已达标且未抽奖，提示用户先抽奖
    if (currentConsumption >= currentThreshold) {
      throw new BadRequestError('当前场阶进度已达标，请先抽奖再切换场阶');
    }

    // 切换场阶并重置进度
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'mysteryShop.level': targetLevel, 
          'mysteryShop.consumption': 0 
        } 
      },
      { new: true }
    );

    console.log(`[MysteryShop] 用户 ${userId} 切换场阶: ${currentLevel} → ${targetLevel}`);

    return {
      level: targetLevel,
      levelName: LEVEL_NAMES[targetLevel],
      consumption: 0,
      threshold: MYSTERY_SHOP_THRESHOLDS[targetLevel],
      progress: 0,
      canDraw: false
    };
  }

  /**
   * 抽奖（核心方法 - 并发安全）
   */
  static async draw(userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. 获取用户信息
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        throw new NotFoundError('用户不存在');
      }

      const level = user.mysteryShop?.level || 'novice';
      const consumption = user.mysteryShop?.consumption || 0;
      const threshold = MYSTERY_SHOP_THRESHOLDS[level];

      // 2. 校验进度是否达标
      if (consumption < threshold) {
        await session.abortTransaction();
        throw new BadRequestError(`进度不足，需要累计消耗 ${threshold.toLocaleString()} 积分`);
      }

      // 3. 原子操作：重置进度（防止并发抽奖）
      const updatedUser = await User.findOneAndUpdate(
        { 
          _id: userId,
          'mysteryShop.consumption': { $gte: threshold }
        },
        { 
          $set: { 
            'mysteryShop.consumption': 0,
            'mysteryShop.lastDrawAt': new Date()
          } 
        },
        { session, new: true }
      );

      if (!updatedUser) {
        await session.abortTransaction();
        throw new BadRequestError('抽奖失败，进度可能已被使用');
      }

      // 4. 随机抽取奖励
      const reward = this.getRandomReward(level);
      
      // 5. 发放奖励
      let actualAmount = 0;
      let transactionType = 'mystery_shop_reward';

      if (reward.type === 'jackpot_percent') {
        // 奖池百分比奖励
        const jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
        if (!jackpot || jackpot.amount <= 0) {
          // 奖池为空，发放保底积分
          actualAmount = 1000;
          await this.addPoints(userId, actualAmount, session);
          reward.description = '奖池为空，获得保底1000积分';
          reward.type = 'points';
          reward.value = 1000;
        } else {
          actualAmount = jackpot.amount * reward.value;
          actualAmount = Math.min(actualAmount, jackpot.amount); // 不能超过奖池总额
          
          // 从奖池扣除
          jackpot.amount -= actualAmount;
          await jackpot.save({ session });
          
          // 增加用户余额
          await User.findByIdAndUpdate(userId, { $inc: { balance: actualAmount } }, { session });
          transactionType = 'wheel_jackpot';
        }
      } else if (reward.type === 'points') {
        // 积分奖励
        actualAmount = reward.value;
        await this.addPoints(userId, actualAmount, session);
      } else if (reward.type === 'coins') {
        // 小象币奖励
        actualAmount = reward.value;
        await User.findByIdAndUpdate(userId, { $inc: { coins: actualAmount } }, { session });
      } else if (reward.type === 'balance') {
        // 余额奖励
        actualAmount = reward.value;
        await User.findByIdAndUpdate(userId, { $inc: { balance: actualAmount } }, { session });
      }

      // 6. 记录交易流水
      const transaction = await Transaction.create([{
        userId,
        type: transactionType,
        amount: actualAmount,
        description: `神秘商店${LEVEL_NAMES[level]}抽奖：${reward.description}`,
        status: 'completed',
        metadata: {
          level,
          reward: reward.description
        }
      }], { session });

      // 7. 记录抽奖日志
      const log = await MysteryShopLog.create([{
        userId,
        level,
        threshold,
        consumptionBefore: consumption,
        reward: {
          type: reward.type,
          value: reward.value,
          description: reward.description,
          percent: reward.percent
        },
        actualAmount,
        transactionId: transaction[0]._id,
        status: 'completed'
      }], { session });

      await session.commitTransaction();

      console.log(`[MysteryShop] 用户 ${userId} 抽奖成功: ${LEVEL_NAMES[level]} - ${reward.description}`);

      return {
        success: true,
        reward: {
          type: reward.type,
          value: reward.value,
          description: reward.description,
          actualAmount
        },
        newConsumption: 0,
        newThreshold: threshold
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('[MysteryShop] 抽奖失败:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 随机抽取奖励
   */
  static getRandomReward(level) {
    const rewards = REWARDS_CONFIG[level];
    const totalWeight = getTotalWeight(level);
    
    let random = Math.random() * totalWeight;
    
    for (const reward of rewards) {
      random -= reward.weight;
      if (random <= 0) {
        return { ...reward, percent: reward.type === 'jackpot_percent' ? reward.value * 100 : null };
      }
    }
    
    // 保底返回第一个奖励
    return { ...rewards[0], percent: rewards[0].type === 'jackpot_percent' ? rewards[0].value * 100 : null };
  }

  /**
   * 增加积分
   */
  static async addPoints(userId, amount, session) {
    const user = await User.findByIdAndUpdate(
      userId, 
      { $inc: { points: amount } }, 
      { session, new: true }
    );
    return user;
  }

  /**
   * 获取抽奖历史
   */
  static async getDrawHistory(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const logs = await MysteryShopLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MysteryShopLog.countDocuments({ userId });

    return { logs, total, page, limit };
  }

  /**
   * 获取商店统计（管理员）
   */
  static async getShopStats() {
    const stats = await MysteryShopLog.aggregate([
      {
        $group: {
          _id: '$level',
          totalDraws: { $sum: 1 },
          totalRewards: { $sum: '$actualAmount' },
          avgReward: { $avg: '$actualAmount' }
        }
      }
    ]);

    return stats;
  }
}

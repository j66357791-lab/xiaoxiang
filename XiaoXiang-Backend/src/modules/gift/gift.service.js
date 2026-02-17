import GiftPack from './gift.model.js';
import User from '../users/user.model.js';
import Transaction from '../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/error.js';
import { clearCache } from '../../common/middlewares/cache.js';
import mongoose from 'mongoose';

export class GiftService {
  /**
   * 获取所有可购买的礼包
   */
  static async getAvailableGifts() {
    const gifts = await GiftPack.find({
      status: 'available',
      $or: [
        { expireAt: null },
        { expireAt: { $gt: new Date() } }
      ]
    }).sort({ createdAt: -1 });

    return gifts;
  }

  /**
   * 购买礼包
   */
  static async purchaseGift(userId, giftId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 查找礼包
      const gift = await GiftPack.findOne({ giftId }).session(session);
      if (!gift) {
        throw new NotFoundError('礼包不存在');
      }

      if (gift.status !== 'available') {
        throw new BadRequestError('礼包已下架');
      }

      if (gift.soldCount >= gift.totalStock) {
        throw new BadRequestError('礼包已售罄');
      }

      // 检查用户余额
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new NotFoundError('用户不存在');
      }

      if (user.balance < gift.price) {
        throw new BadRequestError('余额不足，请先充值');
      }

      // 检查是否已购买（每人限购）
      const existingPurchase = await Transaction.findOne({
        userId,
        type: 'gift_purchase',
        description: { $regex: gift.name }
      }).session(session);

      if (existingPurchase) {
        throw new ConflictError('您已购买过该礼包，每人限购一次');
      }

      // 扣除余额
      user.balance -= gift.price;
      await user.save();

      // 随机抽取奖励
      const reward = this.drawReward(gift.rewards);

      // 增加积分
      user.points += reward.points;
      await user.save();

      // 更新礼包库存
      gift.soldCount += 1;
      if (gift.soldCount >= gift.totalStock) {
        gift.status = 'sold_out';
      }
      await gift.save();

      // 创建交易记录
      await Transaction.create([{
        userId: user._id,
        type: 'gift_purchase',
        amount: gift.price,
        balanceSnapshot: user.balance,
        description: `购买${gift.name}，获得${reward.points}积分`,
        status: 'completed',
      }, {
        userId: user._id,
        type: 'points_income',
        amount: reward.points,
        balanceSnapshot: user.points,
        description: `${gift.name}奖励`,
        status: 'completed',
      }], { session });

      await session.commitTransaction();
      clearCache('/api/users/profile');

      console.log(`[GiftService] 用户 ${user.email} 购买礼包成功，获得 ${reward.points} 积分`);

      return {
        success: true,
        reward: {
          points: reward.points,
          label: reward.label,
        },
        gift: {
          name: gift.name,
          price: gift.price,
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 随机抽取奖励
   */
  static drawReward(rewards) {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const reward of rewards) {
      cumulative += reward.probability;
      if (random <= cumulative) {
        return reward;
      }
    }

    // 兜底返回第一个
    return rewards[0];
  }

  /**
   * 初始化礼包（管理员）
   */
  static async initGiftPacks() {
    const existingGift = await GiftPack.findOne({ giftId: 'new_year_2024' });
    
    if (existingGift) {
      return existingGift;
    }

    const newYearGift = await GiftPack.create({
      giftId: 'new_year_2024',
      name: '🎊 新年礼包',
      price: 8.88,
      rewards: [
        { points: 666, probability: 40, label: '666积分' },
        { points: 888, probability: 30, label: '888积分' },
        { points: 1288, probability: 18, label: '1288积分' },
        { points: 1588, probability: 9, label: '1588积分' },
        { points: 1888, probability: 3, label: '1888积分' },
      ],
      totalStock: 200,
      soldCount: 0,
      status: 'available',
      purchaseLimit: 1,
    });

    console.log('[GiftService] 🎁 新年礼包初始化成功');
    return newYearGift;
  }

  /**
   * 获取礼包统计（管理员）
   */
  static async getGiftStats(giftId) {
    const gift = await GiftPack.findOne({ giftId });
    if (!gift) {
      throw new NotFoundError('礼包不存在');
    }

    const purchases = await Transaction.find({
      type: 'gift_purchase',
      description: { $regex: gift.name }
    }).populate('userId', 'email name');

    return {
      gift: {
        name: gift.name,
        price: gift.price,
        totalStock: gift.totalStock,
        soldCount: gift.soldCount,
        remainingCount: gift.totalStock - gift.soldCount,
        status: gift.status,
      },
      purchases: purchases.map(p => ({
        user: p.userId,
        amount: p.amount,
        description: p.description,
        createdAt: p.createdAt,
      })),
      totalRevenue: gift.price * gift.soldCount,
    };
  }
}

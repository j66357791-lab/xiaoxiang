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
   * 获取所有礼包（管理员）
   */
  static async getAllGifts() {
    const gifts = await GiftPack.find().sort({ createdAt: -1 });
    return gifts;
  }

  /**
   * 获取礼包详情
   */
  static async getGiftById(giftId) {
    const gift = await GiftPack.findOne({ giftId });
    if (!gift) {
      throw new NotFoundError('礼包不存在');
    }
    return gift;
  }

  /**
   * 创建新礼包
   */
  static async createGiftPack(data) {
    const { giftId, name, price, rewards, totalStock, purchaseLimit, expireAt } = data;

    // 检查giftId是否已存在
    const existing = await GiftPack.findOne({ giftId });
    if (existing) {
      throw new ConflictError('礼包ID已存在');
    }

    // 处理 rewards，自动生成 label
    const processedRewards = rewards.map(r => ({
      points: r.points,
      probability: r.probability,
      label: r.label || `${r.points}积分`,
    }));

    // 验证概率总和是否为100
    const totalProbability = processedRewards.reduce((sum, r) => sum + r.probability, 0);
    if (Math.abs(totalProbability - 100) > 0.01) {
      throw new BadRequestError(`概率总和必须为100%，当前为${totalProbability}%`);
    }

    const gift = await GiftPack.create({
      giftId,
      name,
      price,
      rewards: processedRewards,
      totalStock,
      purchaseLimit: purchaseLimit || 1,
      expireAt: expireAt || null,
      soldCount: 0,
      status: 'available',
    });

    console.log(`[GiftService] 🎁 创建礼包成功: ${name}`);
    return gift;
  }

  /**
   * 更新礼包
   */
  static async updateGiftPack(giftId, data) {
    const gift = await GiftPack.findOne({ giftId });
    if (!gift) {
      throw new NotFoundError('礼包不存在');
    }

    const { name, price, rewards, totalStock, purchaseLimit, expireAt, status } = data;

    // 如果更新了概率，验证总和
    if (rewards && rewards.length > 0) {
      // 处理 rewards，自动生成 label
      const processedRewards = rewards.map(r => ({
        points: r.points,
        probability: r.probability,
        label: r.label || `${r.points}积分`,
      }));

      const totalProbability = processedRewards.reduce((sum, r) => sum + r.probability, 0);
      if (Math.abs(totalProbability - 100) > 0.01) {
        throw new BadRequestError(`概率总和必须为100%，当前为${totalProbability}%`);
      }
      
      gift.rewards = processedRewards;
    }

    // 更新字段
    if (name) gift.name = name;
    if (price !== undefined) gift.price = price;
    if (totalStock !== undefined) gift.totalStock = totalStock;
    if (purchaseLimit !== undefined) gift.purchaseLimit = purchaseLimit;
    if (expireAt !== undefined) gift.expireAt = expireAt;
    if (status) gift.status = status;

    await gift.save();
    console.log(`[GiftService] 🎁 更新礼包成功: ${gift.name}`);
    return gift;
  }

  /**
   * 删除礼包（软删除，改为下架状态）
   */
  static async deleteGiftPack(giftId) {
    const gift = await GiftPack.findOne({ giftId });
    if (!gift) {
      throw new NotFoundError('礼包不存在');
    }

    gift.status = 'offline';
    await gift.save();
    console.log(`[GiftService] 🎁 下架礼包: ${gift.name}`);
    return { message: '礼包已下架' };
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

      // ✅ 创建交易记录（添加 ordered: true）
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
      }], { session, ordered: true });

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

    // 获取购买记录
    const purchases = await Transaction.find({
      type: 'gift_purchase',
      description: { $regex: gift.name }
    }).populate('userId', 'email name');

    // 统计各奖励获得次数
    const rewardStats = {};
    gift.rewards.forEach(r => {
      rewardStats[r.label] = { count: 0, expected: r.probability };
    });

    purchases.forEach(p => {
      // 从描述中提取获得的积分数
      const match = p.description.match(/获得(\d+)积分/);
      if (match) {
        const points = parseInt(match[1]);
        const reward = gift.rewards.find(r => r.points === points);
        if (reward && rewardStats[reward.label]) {
          rewardStats[reward.label].count++;
        }
      }
    });

    // 计算实际概率
    const totalSold = purchases.length;
    Object.keys(rewardStats).forEach(label => {
      rewardStats[label].actualProbability = totalSold > 0 
        ? ((rewardStats[label].count / totalSold) * 100).toFixed(2) 
        : 0;
    });

    return {
      gift: {
        giftId: gift.giftId,
        name: gift.name,
        price: gift.price,
        totalStock: gift.totalStock,
        soldCount: gift.soldCount,
        remainingCount: gift.totalStock - gift.soldCount,
        status: gift.status,
        purchaseLimit: gift.purchaseLimit,
        createdAt: gift.createdAt,
        expireAt: gift.expireAt,
      },
      stats: {
        totalRevenue: gift.price * gift.soldCount,
        rewardDistribution: rewardStats,
      },
      purchases: purchases.map(p => ({
        _id: p._id,
        user: p.userId,
        amount: p.amount,
        description: p.description,
        createdAt: p.createdAt,
      })),
      rewards: gift.rewards,
    };
  }

  /**
   * 获取所有礼包汇总统计（管理员）
   */
  static async getAllGiftsStats() {
    const gifts = await GiftPack.find();
    
    const stats = await Promise.all(gifts.map(async (gift) => {
      const purchaseCount = await Transaction.countDocuments({
        type: 'gift_purchase',
        description: { $regex: gift.name }
      });
      
      const totalRevenue = gift.price * gift.soldCount;
      
      return {
        giftId: gift.giftId,
        name: gift.name,
        price: gift.price,
        status: gift.status,
        totalStock: gift.totalStock,
        soldCount: gift.soldCount,
        remainingCount: gift.totalStock - gift.soldCount,
        purchaseCount,
        totalRevenue,
        sellRate: ((gift.soldCount / gift.totalStock) * 100).toFixed(1),
      };
    }));

    return stats;
  }
}

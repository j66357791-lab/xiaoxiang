// src/modules/stats/stats.service.js
import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

export class StatsService {
  /**
   * 定义所有休闲中心相关的流水类型
   * 包含：通用类型 + 游戏中心类型
   */
  static get LEISURE_TYPES() {
    return {
      // 通用积分类型
      general: [
        'points_income', 'points_expense',
        'coins_income', 'coins_expense',
        'points_exchange', 'coins_exchange',
        'gift_purchase'
      ],
      // 翻牌游戏
      flipcard: ['flipcard_ticket', 'flipcard_reward', 'flipcard_fee'],
      // 转盘游戏
      wheel: ['wheel_ticket', 'wheel_reward', 'wheel_jackpot', 'wheel_settle_fee'],
      // 神秘商店
      mysteryShop: ['mystery_shop_progress', 'mystery_shop_reward'],
      // 猜拳游戏
      caiquan: ['caiquan_ticket', 'caiquan_reward']
    };
  }

  // 获取所有类型的扁平数组
  static get ALL_LEISURE_TYPES() {
    return Object.values(this.LEISURE_TYPES).flat();
  }

  /**
   * 获取货币总览统计（用户端简化版）
   */
  static async getCurrencyOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 定义发行(收入)和销毁(支出)类型
    const issuedTypes = [
      'points_income', 'points_exchange', 'coins_income', 'coins_exchange',
      'flipcard_reward', 'wheel_reward', 'wheel_jackpot', 'mystery_shop_reward', 'caiquan_reward'
    ];
    const destroyedTypes = [
      'points_expense', 'coins_expense',
      'flipcard_ticket', 'flipcard_fee', 
      'wheel_ticket', 'wheel_settle_fee', 
      'mystery_shop_progress',
      'caiquan_ticket'
    ];

    const [
      pointsTotalIssued,
      pointsTotalDestroyed,
      pointsInCirculation,
      pointsTodayIssued,
      pointsTodayDestroyed
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: issuedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: destroyedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$points' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: issuedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: destroyedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const issued = pointsTotalIssued[0]?.total || 0;
    const destroyed = pointsTotalDestroyed[0]?.total || 0;
    const circulation = pointsInCirculation[0]?.total || 0;

    return {
      points: {
        totalIssued: issued,
        totalDestroyed: destroyed,
        inCirculation: circulation,
        todayIssued: pointsTodayIssued[0]?.total || 0,
        todayDestroyed: pointsTodayDestroyed[0]?.total || 0
      }
    };
  }

  /**
   * 获取详细货币统计（管理员）
   */
  static async getCurrencyDetail(days = 30) {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const overview = await this.getCurrencyOverview();
    const dailyTrend = await this.getDailyTrend(startDate);
    const typeDistribution = await this.getTypeDistribution(startDate);

    return {
      overview,
      dailyTrend,
      typeDistribution,
      period: { start: startDate, end: now, days }
    };
  }

  /**
   * 获取每日趋势
   */
  static async getDailyTrend(startDate) {
    const issuedTypes = ['points_income', 'points_exchange'];
    const destroyedTypes = ['points_expense'];

    const [issued, destroyed] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: issuedTypes }, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: destroyedTypes }, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    return {
      issued: issued.map(d => ({ date: d._id, amount: d.total })),
      destroyed: destroyed.map(d => ({ date: d._id, amount: d.total }))
    };
  }

  /**
   * 获取交易类型分布
   */
  static async getTypeDistribution(startDate) {
    const distribution = await Transaction.aggregate([
      { $match: { type: { $in: this.ALL_LEISURE_TYPES }, createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    return distribution.map(d => ({ type: d._id, count: d.count, total: d.total }));
  }

  /**
   * 获取用户休闲中心流水（7天）
   */
  static async getUserLeisureTransactions(userId, page = 1, limit = 20) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      type: { $in: this.ALL_LEISURE_TYPES },
      createdAt: { $gte: sevenDaysAgo }
    };

    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    return {
      transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    };
  }
}

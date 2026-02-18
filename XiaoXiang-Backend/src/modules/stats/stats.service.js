import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

export class StatsService {
  /**
   * 获取货币总览统计（用户端简化版）
   * 🔧 修复：正确的发行/销毁统计逻辑
   */
  static async getCurrencyOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 🔧 定义类型分类
    // 平台发行类型：用户获得货币（礼包奖励、活动奖励、游戏盈利、兑换获得等）
    const pointsIssuedTypes = ['points_income', 'points_exchange'];
    // 平台销毁类型：用户消费/损失货币（手续费、游戏亏损、消费等）
    const pointsDestroyedTypes = ['points_expense'];
    
    const coinsIssuedTypes = ['coins_income', 'coins_exchange'];
    const coinsDestroyedTypes = ['coins_expense'];

    const [
      // 累计发行：所有收入类型流水的总和
      pointsTotalIssued,
      coinsTotalIssued,
      
      // 累计销毁：所有支出类型流水的总和
      pointsTotalDestroyed,
      coinsTotalDestroyed,
      
      // 流通中：所有用户余额之和
      pointsInCirculation,
      coinsInCirculation,
      
      // 今日统计
      pointsTodayIssued,
      pointsTodayDestroyed,
      coinsTodayIssued,
      coinsTodayDestroyed
    ] = await Promise.all([
      // 积分累计发行
      Transaction.aggregate([
        { $match: { type: { $in: pointsIssuedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币累计发行
      Transaction.aggregate([
        { $match: { type: { $in: coinsIssuedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分累计销毁
      Transaction.aggregate([
        { $match: { type: { $in: pointsDestroyedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币累计销毁
      Transaction.aggregate([
        { $match: { type: { $in: coinsDestroyedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分流通中（用户余额总和）
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$points' } } }
      ]),
      
      // 小象币流通中（用户余额总和）
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$coins' } } }
      ]),
      
      // 积分今日发行
      Transaction.aggregate([
        { $match: { type: { $in: pointsIssuedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分今日销毁
      Transaction.aggregate([
        { $match: { type: { $in: pointsDestroyedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币今日发行
      Transaction.aggregate([
        { $match: { type: { $in: coinsIssuedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币今日销毁
      Transaction.aggregate([
        { $match: { type: { $in: coinsDestroyedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // 提取数值
    const issuedP = pointsTotalIssued[0]?.total || 0;
    const destroyedP = pointsTotalDestroyed[0]?.total || 0;
    const issuedC = coinsTotalIssued[0]?.total || 0;
    const destroyedC = coinsTotalDestroyed[0]?.total || 0;
    const circulationP = pointsInCirculation[0]?.total || 0;
    const circulationC = coinsInCirculation[0]?.total || 0;

    console.log('[Stats] 📊 货币统计:', {
      points: { issued: issuedP, destroyed: destroyedP, circulation: circulationP, diff: issuedP - destroyedP },
      coins: { issued: issuedC, destroyed: destroyedC, circulation: circulationC, diff: issuedC - destroyedC }
    });

    return {
      points: {
        totalIssued: issuedP,           // 累计发行（平台发出的）
        totalDestroyed: destroyedP,     // 累计销毁（平台回收的）
        inCirculation: circulationP,    // 流通中（用户余额总和）
        todayIssued: pointsTodayIssued[0]?.total || 0,
        todayDestroyed: pointsTodayDestroyed[0]?.total || 0
      },
      coins: {
        totalIssued: issuedC,
        totalDestroyed: destroyedC,
        inCirculation: circulationC,
        todayIssued: coinsTodayIssued[0]?.total || 0,
        todayDestroyed: coinsTodayDestroyed[0]?.total || 0
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
      period: {
        start: startDate,
        end: now,
        days
      }
    };
  }

  /**
   * 获取每日趋势
   */
  static async getDailyTrend(startDate) {
    const pointsIssuedTypes = ['points_income', 'points_exchange'];
    const pointsDestroyedTypes = ['points_expense'];
    const coinsIssuedTypes = ['coins_income', 'coins_exchange'];
    const coinsDestroyedTypes = ['coins_expense'];

    const [
      pointsDailyIssued,
      pointsDailyDestroyed,
      coinsDailyIssued,
      coinsDailyDestroyed
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: pointsIssuedTypes }, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: pointsDestroyedTypes }, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: coinsIssuedTypes }, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: coinsDestroyedTypes }, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    return {
      points: {
        issued: pointsDailyIssued.map(d => ({ date: d._id, amount: d.total })),
        destroyed: pointsDailyDestroyed.map(d => ({ date: d._id, amount: d.total }))
      },
      coins: {
        issued: coinsDailyIssued.map(d => ({ date: d._id, amount: d.total })),
        destroyed: coinsDailyDestroyed.map(d => ({ date: d._id, amount: d.total }))
      }
    };
  }

  /**
   * 获取交易类型分布
   */
  static async getTypeDistribution(startDate) {
    const leisureTypes = [
      'points_income', 'points_expense',
      'coins_income', 'coins_expense',
      'points_exchange', 'coins_exchange'
    ];

    const distribution = await Transaction.aggregate([
      { $match: { type: { $in: leisureTypes }, createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    return distribution.map(d => ({
      type: d._id,
      count: d.count,
      total: d.total
    }));
  }

  /**
   * 获取用户休闲中心流水（7天）
   */
  static async getUserLeisureTransactions(userId, page = 1, limit = 20) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const leisureTypes = [
      'points_income', 'points_expense',
      'coins_income', 'coins_expense',
      'points_exchange', 'coins_exchange',
      'gift_purchase',
    ];

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      type: { $in: leisureTypes },
      createdAt: { $gte: sevenDaysAgo }
    };

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    const overview = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            category: {
              $switch: {
                branches: [
                  { case: { $in: ['$type', ['points_income', 'points_exchange', 'gift_purchase']] }, then: 'points_income' },
                  { case: { $in: ['$type', ['points_expense']] }, then: 'points_expense' },
                  { case: { $in: ['$type', ['coins_income', 'coins_exchange']] }, then: 'coins_income' },
                  { case: { $in: ['$type', ['coins_expense']] }, then: 'coins_expense' }
                ],
                default: 'other'
              }
            }
          },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const overviewData = {
      points: { earned: 0, spent: 0 },
      coins: { earned: 0, spent: 0 }
    };

    overview.forEach(item => {
      if (item._id.category === 'points_income') overviewData.points.earned = item.total;
      if (item._id.category === 'points_expense') overviewData.points.spent = item.total;
      if (item._id.category === 'coins_income') overviewData.coins.earned = item.total;
      if (item._id.category === 'coins_expense') overviewData.coins.spent = item.total;
    });

    return {
      overview: overviewData,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      period: {
        start: sevenDaysAgo,
        end: new Date()
      }
    };
  }
}

import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

export class StatsService {
  /**
   * 定义所有休闲中心相关的流水类型
   */
  static get LEISURE_TYPES() {
    return {
      general: [
        'points_income', 'points_expense',
        'coins_income', 'coins_expense',
        'points_exchange', 'coins_exchange',
        'gift_purchase',
        'mining_invest',
        'mining_reward',
        'mining_exchange',
        'order_reward',  // 🆕 订单奖励
      ],
      flipcard: ['flipcard_ticket', 'flipcard_reward', 'flipcard_fee'],
      wheel: ['wheel_ticket', 'wheel_reward', 'wheel_jackpot', 'wheel_settle_fee'],
      mysteryShop: ['mystery_shop_progress', 'mystery_shop_reward'],
      caiquan: ['caiquan_ticket', 'caiquan_reward'],
      race: ['race_bet', 'race_reward']
    };
  }

  static get ALL_LEISURE_TYPES() {
    return Object.values(this.LEISURE_TYPES).flat();
  }

  /**
   * 游戏类型配置
   */
  static get GAME_TYPES() {
    return {
      flipcard: { ticket: 'flipcard_ticket', reward: 'flipcard_reward' },
      wheel: { ticket: 'wheel_ticket', reward: 'wheel_reward', jackpot: 'wheel_jackpot' },
      caiquan: { ticket: 'caiquan_ticket', reward: 'caiquan_reward' },
      race: { ticket: 'race_bet', reward: 'race_reward' },
      mysteryShop: { progress: 'mystery_shop_progress', reward: 'mystery_shop_reward' }
    };
  }

  /**
   * 计算单个游戏的净发行/净销毁
   */
  static async calculateGameNetFlow(gameKey, startDate = null) {
    const gameConfig = this.GAME_TYPES[gameKey];
    if (!gameConfig) return { netIssued: 0, netDestroyed: 0 };

    const matchFilter = startDate ? { createdAt: { $gte: startDate } } : {};

    const gameTypes = Object.values(gameConfig);
    const transactions = await Transaction.aggregate([
      { $match: { ...matchFilter, type: { $in: gameTypes } } },
      { 
        $group: { 
          _id: '$type', 
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        } 
      }
    ]);

    const totals = {};
    transactions.forEach(t => {
      totals[t._id] = t.total;
    });

    const ticketAmount = totals[gameConfig.ticket] || 0;
    const rewardAmount = totals[gameConfig.reward] || 0;
    const jackpotAmount = totals[gameConfig.jackpot] || 0;
    const totalReward = rewardAmount + jackpotAmount;

    const netFlow = totalReward - ticketAmount;
    
    if (netFlow > 0) {
      return { netIssued: netFlow, netDestroyed: 0 };
    } else {
      return { netIssued: 0, netDestroyed: Math.abs(netFlow) };
    }
  }

  /**
   * 获取货币总览统计（用户端简化版）
   */
  static async getCurrencyOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ==================== 积分统计 ====================
    
    // 积分净发行类型
    const pointsNetIssuedTypes = [
      'gift_purchase',
      'points_income',
      'mining_exchange',
      'order_reward',  // 🆕 订单奖励计入发行
    ];

    // 积分净销毁类型
    const pointsNetDestroyedTypes = [
      'points_exchange',
      'points_expense',
      'mining_invest',
    ];

    const [
      pointsTotalIssued,
      pointsTotalDestroyed,
      pointsInCirculation,
      pointsTodayIssued,
      pointsTodayDestroyed
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: pointsNetIssuedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: pointsNetDestroyedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$points' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: pointsNetIssuedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: pointsNetDestroyedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // 计算游戏净发行/销毁
    const gameKeys = Object.keys(this.GAME_TYPES);
    let gameNetIssued = 0;
    let gameNetDestroyed = 0;
    let todayGameNetIssued = 0;
    let todayGameNetDestroyed = 0;

    for (const key of gameKeys) {
      const total = await this.calculateGameNetFlow(key);
      const today = await this.calculateGameNetFlow(key, startOfToday);
      gameNetIssued += total.netIssued;
      gameNetDestroyed += total.netDestroyed;
      todayGameNetIssued += today.netIssued;
      todayGameNetDestroyed += today.netDestroyed;
    }

    // ==================== 小象币统计 ====================
    
    const coinsIssuedTypes = ['mining_reward'];
    const coinsDestroyedTypes = ['mining_exchange', 'coins_transfer_fee'];

    const [
      coinsTotalIssued,
      coinsTotalDestroyed,
      coinsInCirculation,
      coinsTodayIssued,
      coinsTodayDestroyed
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: coinsIssuedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: coinsDestroyedTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$coins' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: coinsIssuedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: coinsDestroyedTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // ==================== 汇总结果 ====================
    
    const pointsIssued = (pointsTotalIssued[0]?.total || 0) + gameNetIssued;
    const pointsDestroyed = (pointsTotalDestroyed[0]?.total || 0) + gameNetDestroyed;
    const pointsCirculation = pointsInCirculation[0]?.total || 0;
    const pointsTodayIss = (pointsTodayIssued[0]?.total || 0) + todayGameNetIssued;
    const pointsTodayDes = (pointsTodayDestroyed[0]?.total || 0) + todayGameNetDestroyed;

    const coinsIssued = coinsTotalIssued[0]?.total || 0;
    const coinsDestroyed = coinsTotalDestroyed[0]?.total || 0;
    const coinsCirculation = coinsInCirculation[0]?.total || 0;

    console.log('[Stats] 📊 货币统计:', {
      points: { 
        issued: pointsIssued, 
        destroyed: pointsDestroyed, 
        circulation: pointsCirculation,
        todayIssued: pointsTodayIss,
        todayDestroyed: pointsTodayDes
      },
      coins: { 
        issued: coinsIssued, 
        destroyed: coinsDestroyed, 
        circulation: coinsCirculation,
        todayIssued: coinsTodayIssued[0]?.total || 0,
        todayDestroyed: coinsTodayDestroyed[0]?.total || 0
      }
    });

    return {
      points: {
        totalIssued: pointsIssued,
        totalDestroyed: pointsDestroyed,
        inCirculation: pointsCirculation,
        todayIssued: pointsTodayIss,
        todayDestroyed: pointsTodayDes
      },
      coins: {
        totalIssued: coinsIssued,
        totalDestroyed: coinsDestroyed,
        inCirculation: coinsCirculation,
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
      period: { start: startDate, end: now, days }
    };
  }

  /**
   * 获取每日趋势
   */
  static async getDailyTrend(startDate) {
    const baseIssuedTypes = [
      'gift_purchase',
      'points_income',
      'mining_exchange',
      'order_reward',  // 🆕
    ];
    const baseDestroyedTypes = [
      'points_exchange',
      'points_expense',
      'mining_invest',
    ];

    const [issued, destroyed] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: baseIssuedTypes }, createdAt: { $gte: startDate } } },
        { 
          $group: { 
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, 
            total: { $sum: '$amount' } 
          } 
        },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: baseDestroyedTypes }, createdAt: { $gte: startDate } } },
        { 
          $group: { 
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, 
            total: { $sum: '$amount' } 
          } 
        },
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

    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [
                { $in: ['$type', ['points_income', 'coins_income', 'flipcard_reward', 'wheel_reward', 'wheel_jackpot', 'caiquan_reward', 'race_reward', 'mystery_shop_reward', 'gift_purchase', 'mining_reward', 'order_reward']] },
                '$amount',
                0
              ]
            }
          },
          totalExpense: {
            $sum: {
              $cond: [
                { $in: ['$type', ['points_expense', 'coins_expense', 'flipcard_ticket', 'wheel_ticket', 'caiquan_ticket', 'race_bet', 'mystery_shop_progress', 'points_exchange', 'coins_exchange', 'mining_invest', 'mining_exchange']] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);

    return {
      transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      stats: stats[0] || { totalIncome: 0, totalExpense: 0 }
    };
  }
}

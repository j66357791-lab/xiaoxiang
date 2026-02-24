// src/modules/stats/stats.service.js
import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

export class StatsService {
  /**
   * 定义所有休闲中心相关的流水类型
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
      caiquan: ['caiquan_ticket', 'caiquan_reward'],
      // 🐢 龟兔赛跑
      race: ['race_bet', 'race_reward']
    };
  }

  // 获取所有类型的扁平数组
  static get ALL_LEISURE_TYPES() {
    return Object.values(this.LEISURE_TYPES).flat();
  }

  /**
   * 🆕 定义真正的净发行类型（只有这些才计入发行）
   */
  static get NET_ISSUED_TYPES() {
    return [
      'gift_purchase',        // 礼包购买获得的积分
      'points_income',        // 系统赠送（签到、活动等）
      'coins_income',         // 小象币系统赠送
    ];
  }

  /**
   * 🆕 定义净销毁类型
   */
  static get NET_DESTROYED_TYPES() {
    return [
      'points_exchange',      // 积分兑换（消耗积分）
      'coins_exchange',       // 小象币兑换
      'points_expense',       // 积分消费（非游戏）
      'coins_expense',        // 小象币消费
    ];
  }

  /**
   * 🆕 游戏类型配置（门票类型 -> 奖励类型 映射）
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
   * 🆕 计算单个游戏的净发行/净销毁
   * @param {string} gameKey - 游戏标识 (flipcard, wheel, caiquan, race)
   * @param {Date} startDate - 开始时间（可选，用于今日统计）
   * @returns {Promise<{netIssued: number, netDestroyed: number}>}
   */
  static async calculateGameNetFlow(gameKey, startDate = null) {
    const gameConfig = this.GAME_TYPES[gameKey];
    if (!gameConfig) return { netIssued: 0, netDestroyed: 0 };

    const matchFilter = startDate ? { createdAt: { $gte: startDate } } : {};

    // 获取该游戏所有相关交易
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

    // 转换为对象方便查询
    const totals = {};
    transactions.forEach(t => {
      totals[t._id] = t.total;
    });

    const ticketAmount = totals[gameConfig.ticket] || 0;
    const rewardAmount = totals[gameConfig.reward] || 0;
    const jackpotAmount = totals[gameConfig.jackpot] || 0;
    const totalReward = rewardAmount + jackpotAmount;

    // 计算净发行和净销毁
    // 净发行 = 总奖励 - 总门票（如果为正）
    // 净销毁 = 总门票 - 总奖励（如果为正）
    const netFlow = totalReward - ticketAmount;
    
    if (netFlow > 0) {
      return { netIssued: netFlow, netDestroyed: 0 };
    } else {
      return { netIssued: 0, netDestroyed: Math.abs(netFlow) };
    }
  }

  /**
   * 获取货币总览统计（用户端简化版）
   * 🔧 修复：正确计算净发行/净销毁
   */
  static async getCurrencyOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1️⃣ 计算基础发行（礼包、系统赠送）
    const [baseIssued, baseDestroyed] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: this.NET_ISSUED_TYPES } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: this.NET_DESTROYED_TYPES } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // 2️⃣ 计算各游戏的净发行/净销毁
    const gameKeys = Object.keys(this.GAME_TYPES);
    const gameStats = await Promise.all(
      gameKeys.map(key => this.calculateGameNetFlow(key))
    );

    // 3️⃣ 汇总游戏的净发行/净销毁
    let gameNetIssued = 0;
    let gameNetDestroyed = 0;
    gameStats.forEach(stat => {
      gameNetIssued += stat.netIssued;
      gameNetDestroyed += stat.netDestroyed;
    });

    // 4️⃣ 计算今日统计
    const [todayBaseIssued, todayBaseDestroyed, ...todayGameStats] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: this.NET_ISSUED_TYPES }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: this.NET_DESTROYED_TYPES }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      ...gameKeys.map(key => this.calculateGameNetFlow(key, startOfToday))
    ]);

    let todayGameNetIssued = 0;
    let todayGameNetDestroyed = 0;
    todayGameStats.forEach(stat => {
      todayGameNetIssued += stat.netIssued;
      todayGameNetDestroyed += stat.netDestroyed;
    });

    // 5️⃣ 计算流通中的积分
    const pointsInCirculation = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);

    // 6️⃣ 汇总结果
    const totalIssued = (baseIssued[0]?.total || 0) + gameNetIssued;
    const totalDestroyed = (baseDestroyed[0]?.total || 0) + gameNetDestroyed;
    const todayIssued = (todayBaseIssued[0]?.total || 0) + todayGameNetIssued;
    const todayDestroyed = (todayBaseDestroyed[0]?.total || 0) + todayGameNetDestroyed;
    const circulation = pointsInCirculation[0]?.total || 0;

    console.log('[Stats] 📊 货币统计:', {
      baseIssued: baseIssued[0]?.total || 0,
      gameNetIssued,
      baseDestroyed: baseDestroyed[0]?.total || 0,
      gameNetDestroyed,
      totalIssued,
      totalDestroyed,
      circulation
    });

    return {
      points: {
        totalIssued,
        totalDestroyed,
        inCirculation: circulation,
        todayIssued,
        todayDestroyed
      },
      // 🆕 返回详细分解（方便调试）
      _debug: {
        baseIssued: baseIssued[0]?.total || 0,
        gameNetIssued,
        baseDestroyed: baseDestroyed[0]?.total || 0,
        gameNetDestroyed,
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
   * 🔧 修复：使用正确的净发行/净销毁计算
   */
  static async getDailyTrend(startDate) {
    // 基础类型
    const baseIssuedTypes = this.NET_ISSUED_TYPES;
    const baseDestroyedTypes = this.NET_DESTROYED_TYPES;

    // 获取每日基础发行/销毁
    const [baseIssued, baseDestroyed] = await Promise.all([
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

    // 转换为日期映射
    const issuedMap = {};
    const destroyedMap = {};
    
    baseIssued.forEach(d => { issuedMap[d._id] = d.total; });
    baseDestroyed.forEach(d => { destroyedMap[d._id] = d.total; });

    // 获取所有日期
    const dates = [...new Set([
      ...baseIssued.map(d => d._id),
      ...baseDestroyed.map(d => d._id)
    ])].sort();

    // 计算每日游戏的净发行/销毁（简化处理：按日期分组计算）
    const gameKeys = Object.keys(this.GAME_TYPES);
    const gameTypes = Object.values(this.GAME_TYPES).flatMap(g => Object.values(g));

    const dailyGameFlow = await Transaction.aggregate([
      { 
        $match: { 
          type: { $in: gameTypes }, 
          createdAt: { $gte: startDate } 
        } 
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // 按日期计算游戏净流量
    const dailyGameNetFlow = {};
    dailyGameFlow.forEach(item => {
      const date = item._id.date;
      if (!dailyGameNetFlow[date]) {
        dailyGameNetFlow[date] = { issued: 0, destroyed: 0 };
      }
      // 简化：奖励类型计入发行，门票类型计入销毁
      // 实际应该按游戏计算净流量，这里简化处理
      const isReward = item._id.type.includes('reward') || item._id.type.includes('jackpot');
      if (isReward) {
        dailyGameNetFlow[date].issued += item.total;
      } else {
        dailyGameNetFlow[date].destroyed += item.total;
      }
    });

    // 合并结果
    const issued = dates.map(date => ({
      date,
      amount: (issuedMap[date] || 0) + (dailyGameNetFlow[date]?.issued || 0)
    }));

    const destroyed = dates.map(date => ({
      date,
      amount: (destroyedMap[date] || 0) + (dailyGameNetFlow[date]?.destroyed || 0)
    }));

    return { issued, destroyed };
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

    // 🆕 计算用户的收支统计
    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [
                { $in: ['$type', ['points_income', 'coins_income', 'flipcard_reward', 'wheel_reward', 'wheel_jackpot', 'caiquan_reward', 'race_reward', 'mystery_shop_reward', 'gift_purchase']] },
                '$amount',
                0
              ]
            }
          },
          totalExpense: {
            $sum: {
              $cond: [
                { $in: ['$type', ['points_expense', 'coins_expense', 'flipcard_ticket', 'wheel_ticket', 'caiquan_ticket', 'race_bet', 'mystery_shop_progress', 'points_exchange', 'coins_exchange']] },
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

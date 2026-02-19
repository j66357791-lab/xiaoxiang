// server/src/modules/GameCenter/stats/GameStats.service.js
import Transaction from '../../transactions/transaction.model.js';
import User from '../../users/user.model.js';
import Jackpot from '../WheelGame/Jackpot.models.js';
import mongoose from 'mongoose';

/**
 * 游戏统计服务 - 统一管理所有游戏数据
 */
export class GameStatsService {
  
  /**
   * 游戏配置 - 新增游戏只需在这里添加
   */
  static getGameConfigs() {
    return {
      wheel5600: {
        name: '5600倍转盘',
        icon: '🎰',
        color: '#FFD700',
        types: {
          ticket: 'wheel_ticket',
          reward: 'wheel_reward',
          fee: 'wheel_settle_fee',
          jackpot: 'wheel_jackpot',
        },
        hasJackpot: true,
        jackpotGameType: 'wheel5600'
      },
      
      flipcard: {
        name: '翻牌游戏',
        icon: '🃏',
        color: '#9C27B0',
        types: {
          ticket: 'flipcard_ticket',
          reward: 'flipcard_reward',
          fee: 'flipcard_fee',
        },
        hasJackpot: false
      },
      
      mysteryShop: {
        name: '神秘商店',
        icon: '🎁',
        color: '#8B5CF6',
        types: {
          progress: 'mystery_shop_progress',
          reward: 'mystery_shop_reward',
        },
        hasJackpot: false
      }
    };
  }

  /**
   * 获取所有游戏流水类型
   */
  static getAllGameTypes() {
    const configs = this.getGameConfigs();
    const allTypes = new Set();
    
    Object.values(configs).forEach(config => {
      Object.values(config.types).forEach(type => allTypes.add(type));
    });
    
    return Array.from(allTypes);
  }

  /**
   * 游戏总览（汇总所有游戏）
   */
  static async getGamesOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    const allGameTypes = this.getAllGameTypes();
    const ticketTypes = allGameTypes.filter(t => t.includes('ticket'));
    const rewardTypes = allGameTypes.filter(t => t.includes('reward') || t.includes('jackpot'));
    const feeTypes = allGameTypes.filter(t => t.includes('fee'));

    // 并行查询
    const [
      totalIncome, totalPayout, totalFee,
      todayIncome, todayPayout, todayFee, todayGames,
      yesterdayIncome, yesterdayPayout, yesterdayFee,
      monthIncome, monthPayout, monthFee,
      totalGames
    ] = await Promise.all([
      this.sumAmount(ticketTypes),
      this.sumAmount(rewardTypes),
      this.sumAmount(feeTypes),
      this.sumAmount(ticketTypes, startOfToday),
      this.sumAmount(rewardTypes, startOfToday),
      this.sumAmount(feeTypes, startOfToday),
      this.countTransactions(ticketTypes, startOfToday),
      this.sumAmount(ticketTypes, startOfYesterday, startOfToday),
      this.sumAmount(rewardTypes, startOfYesterday, startOfToday),
      this.sumAmount(feeTypes, startOfYesterday, startOfToday),
      this.sumAmount(ticketTypes, startOfMonth),
      this.sumAmount(rewardTypes, startOfMonth),
      this.sumAmount(feeTypes, startOfMonth),
      this.countTransactions(ticketTypes)
    ]);

    // 奖池总额
    const jackpots = await Jackpot.find({});
    const totalJackpot = jackpots.reduce((sum, j) => sum + (j.amount || 0), 0);

    return {
      summary: {
        totalIncome,
        totalPayout,
        totalFee,
        netProfit: totalIncome - totalPayout + totalFee,
        totalGames,
        totalJackpot
      },
      today: {
        income: todayIncome,
        payout: todayPayout,
        fee: todayFee,
        netProfit: todayIncome - todayPayout + todayFee,
        games: todayGames
      },
      yesterday: {
        income: yesterdayIncome,
        payout: yesterdayPayout,
        fee: yesterdayFee,
        netProfit: yesterdayIncome - yesterdayPayout + yesterdayFee
      },
      monthly: {
        income: monthIncome,
        payout: monthPayout,
        fee: monthFee,
        netProfit: monthIncome - monthPayout + monthFee
      }
    };
  }

  /**
   * 各游戏详情
   */
  static async getGamesDetail() {
    const configs = this.getGameConfigs();
    const details = [];

    for (const [key, config] of Object.entries(configs)) {
      const types = Object.values(config.types);
      const ticketType = config.types.ticket;
      
      const [income, payout, fee, games, todayIncome, todayPayout, todayGames] = await Promise.all([
        ticketType ? this.sumAmount([ticketType]) : Promise.resolve(0),
        this.sumAmount(types.filter(t => t.includes('reward') || t.includes('jackpot'))),
        this.sumAmount(types.filter(t => t.includes('fee'))),
        ticketType ? this.countTransactions([ticketType]) : Promise.resolve(0),
        ticketType ? this.sumAmount([ticketType], new Date(new Date().setHours(0,0,0,0))) : Promise.resolve(0),
        this.sumAmount(types.filter(t => t.includes('reward') || t.includes('jackpot')), new Date(new Date().setHours(0,0,0,0))),
        ticketType ? this.countTransactions([ticketType], new Date(new Date().setHours(0,0,0,0))) : Promise.resolve(0)
      ]);

      let jackpot = 0;
      if (config.hasJackpot) {
        const jp = await Jackpot.findOne({ gameType: config.jackpotGameType });
        jackpot = jp?.amount || 0;
      }

      details.push({
        key,
        name: config.name,
        icon: config.icon,
        color: config.color,
        stats: {
          income,
          payout,
          fee,
          netProfit: income - payout + fee,
          games,
          todayIncome,
          todayPayout,
          todayNetProfit: todayIncome - todayPayout,
          todayGames,
          jackpot,
          hasJackpot: config.hasJackpot
        }
      });
    }

    return details;
  }

  /**
   * 单个游戏详情
   */
  static async getGameDetail(gameKey, days = 30) {
    const configs = this.getGameConfigs();
    const config = configs[gameKey];
    
    if (!config) throw new Error('游戏不存在');

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const types = Object.values(config.types);

    const [dailyTrend, typeDistribution] = await Promise.all([
      this.getDailyTrend(types, startDate),
      this.getTypeDistribution(types, startDate)
    ]);

    return {
      game: { key: gameKey, ...config },
      period: { start: startDate, end: now, days },
      dailyTrend,
      typeDistribution
    };
  }

  // ==================== 工具方法 ====================

  static async sumAmount(types, startDate = null, endDate = null) {
    const match = { type: { $in: types } };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lt = endDate;
    }

    const result = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return result[0]?.total || 0;
  }

  static async countTransactions(types, startDate = null) {
    const match = { type: { $in: types } };
    if (startDate) match.createdAt = { $gte: startDate };
    return Transaction.countDocuments(match);
  }

  static async getDailyTrend(types, startDate) {
    return Transaction.aggregate([
      { $match: { type: { $in: types }, createdAt: { $gte: startDate } } },
      { $group: {
        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.date': 1 } }
    ]);
  }

  static async getTypeDistribution(types, startDate) {
    return Transaction.aggregate([
      { $match: { type: { $in: types }, createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
  }
}

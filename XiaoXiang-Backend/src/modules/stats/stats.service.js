import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

export class StatsService {
  /**
   * 获取货币总览统计（用户端简化版）
   */
  static async getCurrencyOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 积分相关类型
    const pointsIncomeTypes = ['points_income', 'points_exchange'];
    const pointsExpenseTypes = ['points_expense'];

    // 小象币相关类型
    const coinsIncomeTypes = ['coins_income', 'coins_exchange'];
    const coinsExpenseTypes = ['coins_expense'];

    // 聚合统计
    const [
      pointsTotalIssued,
      pointsTotalDestroyed,
      pointsTodayIssued,
      pointsTodayDestroyed,
      coinsTotalIssued,
      coinsTotalDestroyed,
      coinsTodayIssued,
      coinsTodayDestroyed,
      pointsInCirculation,
      coinsInCirculation
    ] = await Promise.all([
      // 积分累计发行
      Transaction.aggregate([
        { $match: { type: { $in: pointsIncomeTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分累计销毁
      Transaction.aggregate([
        { $match: { type: { $in: pointsExpenseTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分今日发行
      Transaction.aggregate([
        { $match: { type: { $in: pointsIncomeTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分今日销毁
      Transaction.aggregate([
        { $match: { type: { $in: pointsExpenseTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币累计发行
      Transaction.aggregate([
        { $match: { type: { $in: coinsIncomeTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币累计销毁
      Transaction.aggregate([
        { $match: { type: { $in: coinsExpenseTypes } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币今日发行
      Transaction.aggregate([
        { $match: { type: { $in: coinsIncomeTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 小象币今日销毁
      Transaction.aggregate([
        { $match: { type: { $in: coinsExpenseTypes }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 积分流通中（所有用户的积分总和）
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$points' } } }
      ]),
      
      // 小象币流通中（所有用户的小象币总和）
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$coins' } } }
      ])
    ]);

    return {
      points: {
        totalIssued: pointsTotalIssued[0]?.total || 0,
        totalDestroyed: pointsTotalDestroyed[0]?.total || 0,
        inCirculation: pointsInCirculation[0]?.total || 0,
        todayIssued: pointsTodayIssued[0]?.total || 0,
        todayDestroyed: pointsTodayDestroyed[0]?.total || 0
      },
      coins: {
        totalIssued: coinsTotalIssued[0]?.total || 0,
        totalDestroyed: coinsTotalDestroyed[0]?.total || 0,
        inCirculation: coinsInCirculation[0]?.total || 0,
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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const pointsIncomeTypes = ['points_income', 'points_exchange'];
    const pointsExpenseTypes = ['points_expense'];
    const coinsIncomeTypes = ['coins_income', 'coins_exchange'];
    const coinsExpenseTypes = ['coins_expense'];

    // 获取基础统计
    const overview = await this.getCurrencyOverview();

    // 获取每日趋势数据
    const dailyTrend = await this.getDailyTrend(startDate);

    // 获取交易类型分布
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
    const pointsIncomeTypes = ['points_income', 'points_exchange'];
    const pointsExpenseTypes = ['points_expense'];
    const coinsIncomeTypes = ['coins_income', 'coins_exchange'];
    const coinsExpenseTypes = ['coins_expense'];

    const [
      pointsDailyIssued,
      pointsDailyDestroyed,
      coinsDailyIssued,
      coinsDailyDestroyed
    ] = await Promise.all([
      // 积分每日发行
      Transaction.aggregate([
        {
          $match: {
            type: { $in: pointsIncomeTypes },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // 积分每日销毁
      Transaction.aggregate([
        {
          $match: {
            type: { $in: pointsExpenseTypes },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // 小象币每日发行
      Transaction.aggregate([
        {
          $match: {
            type: { $in: coinsIncomeTypes },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // 小象币每日销毁
      Transaction.aggregate([
        {
          $match: {
            type: { $in: coinsExpenseTypes },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            total: { $sum: '$amount' }
          }
        },
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
      {
        $match: {
          type: { $in: leisureTypes },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    return distribution.map(d => ({
      type: d._id,
      count: d.count,
      total: d.total
    }));
  }
}

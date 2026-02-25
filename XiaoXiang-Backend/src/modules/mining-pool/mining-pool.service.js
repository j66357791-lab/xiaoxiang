import { MiningPoolDay, UserInvestment, PriceHistory } from './mining-pool.model.js';
import User from '../users/user.model.js';
import Transaction from '../transactions/transaction.model.js';
import mongoose from 'mongoose';
import { clearCache } from '../../common/middlewares/cache.js';

// ========== 基准参数 ==========
const BASE_PRICE = 217.6;
const BASE_CIRCULATION = 1000000;
const BASE_USERS = 1000;
const MIN_INVESTMENT = 10;
const MAX_INVESTMENT = 50000;
const EXCHANGE_FEE = 0.05;
const MIN_COINS_THRESHOLD = 0.01; // 最低收益阈值
const MAX_DAILY_INVESTMENTS = 3; // 每日最大投入次数

export class MiningPoolService {
  
  // ========== 查询接口 ==========
  
/**
 * 获取今日矿池状态
 */
static async getTodayPool() {
  const today = this.getTodayString();
  let pool = await MiningPoolDay.findOne({ date: today });
  
  if (!pool) {
    const yesterday = this.getYesterdayString();
    const yesterdayPool = await MiningPoolDay.findOne({ date: yesterday });
    
    pool = await MiningPoolDay.create({
      date: today,
      circulatingPoints: yesterdayPool?.circulatingPoints || BASE_CIRCULATION,
      unitPrice: yesterdayPool?.tomorrowExchangeRate || BASE_PRICE,
      status: 'open'
    });
  }
  
  // 🆕 计算实际参与人数（去重）
  const uniqueInvestors = await UserInvestment.distinct('userId', { date: today });
  pool.investorCount = uniqueInvestors.length;
  
  return pool;
}

  
  /**
   * 获取用户今日投入情况
   */
  static async getUserTodayInvestment(userId) {
    const today = this.getTodayString();
    
    const investments = await UserInvestment.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: today
    }).sort({ createdAt: 1 });
    
    const totalAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalEstimatedCoins = investments.reduce((sum, inv) => sum + (inv.estimatedCoins || 0), 0);
    
    return {
      investments,
      count: investments.length,
      totalAmount,
      totalEstimatedCoins,
      remainingChances: MAX_DAILY_INVESTMENTS - investments.length
    };
  }
  
  /**
   * 获取价格历史（走势图）
   */
  static async getPriceHistory(days = 30) {
    const histories = await PriceHistory.find()
      .sort({ date: -1 })
      .limit(days)
      .lean();
    
    return histories.reverse();
  }
  
  /**
   * 获取当前兑换价格
   */
  static async getCurrentExchangeRate() {
    const yesterday = this.getYesterdayString();
    const yesterdayPool = await MiningPoolDay.findOne({ date: yesterday });
    
    if (!yesterdayPool || yesterdayPool.status === 'open') {
      const lastLocked = await MiningPoolDay.findOne({
        status: { $in: ['locked', 'calculated', 'distributed'] }
      }).sort({ date: -1 });
      
      return lastLocked?.tomorrowExchangeRate || BASE_PRICE;
    }
    
    return yesterdayPool.tomorrowExchangeRate;
  }
  
  // ========== 投入接口 ==========
  
  /**
   * 用户投入积分（优化版）
   */
  static async invest(userId, amount) {
    const today = this.getTodayString();
    const now = new Date();
    
    // 1. 检查时间（23:00 后禁止投入）
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    const deadlineTime = 23 * 60; // 23:00
    
    if (currentTime >= deadlineTime) {
      throw new Error('今日矿池已截止投入，请明天再来');
    }
    
    // 2. 检查矿池状态
    let pool = await this.getTodayPool();
    
    if (pool.status !== 'open') {
      throw new Error('今日矿池已锁定，无法投入');
    }
    
    // 3. 检查投入金额
    if (amount < MIN_INVESTMENT) {
      throw new Error(`最小投入金额为 ${MIN_INVESTMENT} 积分`);
    }
    
    // 4. 检查用户今日投入次数
    const todayInvestments = await UserInvestment.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: today
    });
    
    if (todayInvestments.length >= MAX_DAILY_INVESTMENTS) {
      throw new Error(`每人每日最多投入 ${MAX_DAILY_INVESTMENTS} 次，您今日已用完`);
    }
    
    // 5. 检查用户积分余额
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.points < amount) {
      throw new Error('积分不足');
    }
    
    // 6. 计算预计收益
    const newPrice = this.calculateUnitPrice(pool);
    const estimatedCoins = amount / newPrice;
    
    // 7. 检查最低收益阈值
    if (estimatedCoins < MIN_COINS_THRESHOLD) {
      // 收益不足 0.01 小象币，拒绝投入
      throw new Error(`投入 ${amount} 积分预计只能获得 ${estimatedCoins.toFixed(4)} 小象币，不足最低标准 0.01 小象币。建议增加投入金额。`);
    }
    
    // 8. 扣除用户积分
    user.points -= amount;
    await user.save();
    
    // 9. 记录交易
    await Transaction.create({
      userId: user._id,
      type: 'mining_invest',
      amount: amount,
      balanceSnapshot: user.points,
      description: `矿池投入（第${todayInvestments.length + 1}次）`,
      status: 'completed'
    });
    
    // 10. 创建投入记录
    const investment = await UserInvestment.create({
      userId: userId,
      date: today,
      amount: amount,
      estimatedCoins: estimatedCoins,
      investedAt: now,
      status: 'pending'
    });
    
    // 11. 更新矿池统计
    pool.totalInvested += amount;
    pool.burnedPoints += amount;
    pool.investorCount = await UserInvestment.distinct('userId', { date: today }).countDocuments() || pool.investorCount + 1;
    pool.circulatingPoints -= amount;
    await pool.save();
    
    // 12. 更新矿池单价
    pool.unitPrice = newPrice;
    pool.issuedCoins = pool.totalInvested / newPrice;
    await pool.save();
    
    // 13. 获取用户名和剩余次数
    const userName = user.name || '小象用户';
    const remainingChances = MAX_DAILY_INVESTMENTS - todayInvestments.length - 1;
    
    // 14. 发送投入成功通知
    try {
      const { NotificationService } = await import('../notifications/notification.service.js');
      await NotificationService.createAndSend(
        userId,
        '矿池投入成功',
        `您今日投入 ${amount} 积分已成功注入，预计可瓜分 ${estimatedCoins.toFixed(2)} 小象币。今日剩余投入次数：${remainingChances} 次`,
        'mining',
        { 
          action: 'view_mining', 
          amount: amount, 
          estimatedCoins: estimatedCoins,
          remainingChances: remainingChances
        }
      );
      console.log(`[MiningPool] 📱 投入通知已发送给用户 ${userId}`);
    } catch (notifyErr) {
      console.error('[MiningPool] ⚠️ 投入通知发送失败:', notifyErr.message);
    }
    
    console.log(`[MiningPool] 用户 ${userId} 投入 ${amount} 积分，预计获得 ${estimatedCoins.toFixed(2)} 小象币`);
    
    return {
      success: true,
      investedAmount: amount,
      estimatedCoins: estimatedCoins,
      currentPrice: newPrice,
      poolTotalInvested: pool.totalInvested,
      poolTotalCoins: pool.issuedCoins,
      investmentNumber: todayInvestments.length + 1,
      remainingChances: remainingChances,
      investmentId: investment._id
    };
  }
  
  // ========== 兑换接口 ==========
  
  /**
   * 小象币兑换积分
   */
  static async exchangeCoinsToPoints(userId, coins) {
    if (coins <= 0) {
      throw new Error('兑换数量必须大于0');
    }
    
    const exchangeRate = await this.getCurrentExchangeRate();
    
    const grossPoints = coins * exchangeRate;
    const fee = Math.ceil(grossPoints * EXCHANGE_FEE);
    const netPoints = grossPoints - fee;
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.coins < coins) {
      throw new Error('小象币不足');
    }
    
    user.coins -= coins;
    user.points += netPoints;
    await user.save();
    
    await Transaction.create([{
      userId: user._id,
      type: 'mining_exchange',
      amount: coins,
      coinsSnapshot: user.coins,
      description: `小象币兑换积分：${coins}币 → ${netPoints}积分（手续费${fee}）`,
      status: 'completed'
    }, {
      userId: user._id,
      type: 'points_income',
      amount: netPoints,
      balanceSnapshot: user.points,
      description: `小象币兑换获得：${netPoints}积分`,
      status: 'completed'
    }]);
    
    const today = this.getTodayString();
    await MiningPoolDay.updateOne(
      { date: today },
      { 
        $inc: { 
          issuedPoints: netPoints,
          circulatingPoints: netPoints
        }
      }
    );
    
    console.log(`[MiningPool] 用户 ${userId} 兑换 ${coins} 小象币 → ${netPoints} 积分`);
    
    return {
      success: true,
      coinsSpent: coins,
      pointsReceived: netPoints,
      fee: fee,
      exchangeRate: exchangeRate
    };
  }
  
  // ========== 计算接口 ==========
  
  /**
   * 计算单价（核心公式）
   */
  static calculateUnitPrice(pool) {
    const todayCirculation = pool.circulatingPoints || BASE_CIRCULATION;
    const todayUsers = pool.investorCount || 1;
    const todayInvested = pool.totalInvested || 0;
    
    const inflationFactor = Math.pow(todayCirculation / BASE_CIRCULATION, 0.3);
    const userFactor = Math.pow(todayUsers / Math.max(BASE_USERS, 10), 0.2);
    const burnFactor = 1 + Math.pow(todayInvested / todayCirculation, 0.2);
    
    const maxUserRatio = this.calculateMaxUserRatioSync(pool);
    const concentrationFactor = 1 + Math.pow(Math.max(maxUserRatio - 0.3, 0), 0.5);
    
    const adminFactor = pool.adminFactor || 1.0;
    
    const unitPrice = BASE_PRICE * inflationFactor / userFactor / burnFactor * concentrationFactor * adminFactor;
    
    pool.inflationFactor = inflationFactor;
    pool.userFactor = userFactor;
    pool.burnFactor = burnFactor;
    pool.concentrationFactor = concentrationFactor;
    
    return Math.round(unitPrice * 100) / 100;
  }
  
  /**
   * 同步计算单用户最大占比
   */
  static calculateMaxUserRatioSync(pool) {
    if (!pool.investments || pool.investments.length === 0) {
      return 0;
    }
    
    const userTotals = {};
    pool.investments.forEach(inv => {
      const uid = inv.userId.toString();
      userTotals[uid] = (userTotals[uid] || 0) + inv.amount;
    });
    
    const maxInvestment = Math.max(...Object.values(userTotals));
    const total = pool.totalInvested || 1;
    
    return maxInvestment / total;
  }
  
  // ========== 定时任务 ==========
  
  /**
   * 23:00 锁定矿池 + 退回不足最低收益的投入
   */
  static async lockPool() {
    const today = this.getTodayString();
    const pool = await MiningPoolDay.findOne({ date: today });
    
    if (!pool || pool.status !== 'open') {
      console.log(`[MiningPool] 今日矿池无需锁定`);
      return;
    }
    
    // 1. 获取所有投入记录
    const investments = await UserInvestment.find({ date: today, status: 'pending' });
    
    // 2. 计算最终单价
    const finalPrice = this.calculateUnitPrice(pool);
    pool.unitPrice = finalPrice;
    pool.issuedCoins = pool.totalInvested / finalPrice;
    
    // 3. 检查每个投入是否达到最低收益
    let refundedCount = 0;
    let refundedAmount = 0;
    
    for (const inv of investments) {
      const actualCoins = (inv.amount / pool.totalInvested) * pool.issuedCoins;
      
      if (actualCoins < MIN_COINS_THRESHOLD) {
        // 退回积分
        try {
          const user = await User.findById(inv.userId);
          if (user) {
            user.points += inv.amount;
            await user.save();
            
            // 记录退回交易
            await Transaction.create({
              userId: inv.userId,
              type: 'mining_refund',
              amount: inv.amount,
              balanceSnapshot: user.points,
              description: `矿池投入退回：预计收益不足最低标准`,
              status: 'completed'
            });
            
            // 更新投入记录状态
            inv.status = 'refunded';
            inv.actualCoins = 0;
            await inv.save();
            
            // 更新矿池统计
            pool.totalInvested -= inv.amount;
            pool.burnedPoints -= inv.amount;
            
            // 发送退回通知
            try {
              const { NotificationService } = await import('../notifications/notification.service.js');
              await NotificationService.createAndSend(
                inv.userId,
                '矿池投入退回',
                `很抱歉您今日投入的 ${inv.amount} 积分无法获得瓜分资格，目前您投入的 ${inv.amount} 积分已经给您全额返还账户，欢迎您下次继续参加。`,
                'mining',
                { action: 'view_mining', refundedAmount: inv.amount }
              );
            } catch (notifyErr) {
              console.error('[MiningPool] 退回通知发送失败:', notifyErr.message);
            }
            
            refundedCount++;
            refundedAmount += inv.amount;
          }
        } catch (err) {
          console.error(`[MiningPool] 退回失败: ${inv.userId}`, err.message);
        }
      }
    }
    
    // 4. 重新计算发行量
    pool.issuedCoins = pool.totalInvested / finalPrice;
    pool.status = 'locked';
    pool.tomorrowExchangeRate = finalPrice;
    
    await pool.save();
    
    console.log(`[MiningPool] 🔒 矿池已锁定，单价: ${finalPrice}, 发行: ${pool.issuedCoins.toFixed(2)} 小象币，退回: ${refundedCount} 人，共 ${refundedAmount} 积分`);
  }
  
  /**
   * 23:30 计算分配
   */
  static async calculateDistribution() {
    const today = this.getTodayString();
    const pool = await MiningPoolDay.findOne({ date: today });
    
    if (!pool || pool.status !== 'locked') {
      console.log(`[MiningPool] 今日矿池无需计算`);
      return;
    }
    
    const investments = await UserInvestment.find({ date: today, status: 'pending' });
    
    const totalInvested = pool.totalInvested;
    const totalCoins = pool.issuedCoins;
    
    for (const inv of investments) {
      const ratio = inv.amount / totalInvested;
      const coins = totalCoins * ratio;
      
      inv.actualCoins = Math.round(coins * 100) / 100;
      inv.status = 'completed';
      await inv.save();
    }
    
    pool.status = 'calculated';
    await pool.save();
    
    const yesterday = this.getYesterdayString();
    const yesterdayPool = await MiningPoolDay.findOne({ date: yesterday });
    if (yesterdayPool) {
      const change = pool.unitPrice - yesterdayPool.unitPrice;
      const changePercent = (change / yesterdayPool.unitPrice) * 100;
      pool.priceChange = change;
      pool.priceChangePercent = Math.round(changePercent * 100) / 100;
      await pool.save();
    }
    
    await PriceHistory.create({
      date: today,
      unitPrice: pool.unitPrice,
      issuedCoins: pool.issuedCoins,
      totalInvested: pool.totalInvested,
      investorCount: pool.investorCount,
      changePercent: pool.priceChangePercent,
      exchangeRate: pool.tomorrowExchangeRate
    });
    
    console.log(`[MiningPool] 📊 分配计算完成，共 ${investments.length} 人参与`);
  }
  
  /**
   * 00:00 分发小象币 + 发送到账通知
   */
  static async distributeCoins() {
    const yesterday = this.getYesterdayString();
    const pool = await MiningPoolDay.findOne({ date: yesterday });
    
    if (!pool || pool.status !== 'calculated') {
      console.log(`[MiningPool] 昨日矿池无需分发`);
      return;
    }
    
    const investments = await UserInvestment.find({ 
      date: yesterday, 
      status: 'completed' 
    }).populate('userId');
    
    let successCount = 0;
    let notifyCount = 0;
    
    console.log(`[MiningPool] 💰 开始分发小象币，共 ${investments.length} 人...`);
    
    for (const inv of investments) {
      try {
        if (inv.actualCoins > 0) {
          await User.findByIdAndUpdate(inv.userId._id, {
            $inc: { coins: inv.actualCoins }
          });
          
          await Transaction.create({
            userId: inv.userId._id,
            type: 'mining_reward',
            amount: inv.actualCoins,
            description: `矿池收益：投入${inv.amount}积分`,
            status: 'completed'
          });
          
          const userName = inv.userId?.name || '小象用户';
          
          try {
            const { NotificationService } = await import('../notifications/notification.service.js');
            await NotificationService.createAndSend(
              inv.userId._id,
              '矿池收益到账',
              `亲爱的小象，您昨日投入 ${inv.amount} 积分，获得 ${inv.actualCoins.toFixed(2)} 小象币已到账，可到休闲大厅个人中心部分进行查看哦！`,
              'mining',
              { 
                action: 'view_mining', 
                investedAmount: inv.amount,
                receivedCoins: inv.actualCoins,
                userName: userName
              }
            );
            notifyCount++;
          } catch (notifyErr) {
            console.error(`[MiningPool] ⚠️ 到账通知发送失败: ${inv.userId._id}`, notifyErr.message);
          }
          
          successCount++;
        }
      } catch (err) {
        console.error(`[MiningPool] ❌ 分发失败: ${inv.userId._id}`, err.message);
      }
    }
    
    pool.status = 'distributed';
    await pool.save();
    
    console.log(`[MiningPool] ✅ 小象币分发完成：成功 ${successCount} 人，通知 ${notifyCount} 人`);
  }
  
  // ========== 工具方法 ==========
  
  static getTodayString() {
    const now = new Date();
    const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return beijing.toISOString().split('T')[0];
  }
  
  static getYesterdayString() {
    const now = new Date();
    const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
    return beijing.toISOString().split('T')[0];
  }
  
/**
 * 获取用户投入历史（支持日期筛选）
 */
static async getUserInvestmentHistory(userId, page = 1, limit = 20, startDate = null, endDate = null) {
  const skip = (page - 1) * limit;
  
  // 构建筛选条件
  const filter = {
    userId: new mongoose.Types.ObjectId(userId)
  };
  
  // 日期筛选
  if (startDate && endDate) {
    filter.date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.date = { $gte: startDate };
  } else if (endDate) {
    filter.date = { $lte: endDate };
  }
  
  const [investments, total] = await Promise.all([
    UserInvestment.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    UserInvestment.countDocuments(filter)
  ]);
  
  // 🆕 计算实际参与天数（去重日期）
  const allInvestments = await UserInvestment.find({
    userId: new mongoose.Types.ObjectId(userId)
  }).select('date').lean();
  
  const uniqueDates = [...new Set(allInvestments.map(inv => inv.date))];
  const totalDays = uniqueDates.length;
  
  // 计算筛选后的统计数据
  const stats = {
    totalInvested: investments.reduce((sum, inv) => sum + inv.amount, 0),
    totalReceived: investments.reduce((sum, inv) => sum + (inv.actualCoins || 0), 0),
    totalDays: totalDays
  };
  
  return {
    investments,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    stats
  };
}

  
  /**
   * 获取矿池统计概览
   */
  static async getPoolOverview() {
    const today = this.getTodayString();
    const pool = await this.getTodayPool();
    
    const priceHistory = await this.getPriceHistory(7);
    const exchangeRate = await this.getCurrentExchangeRate();
    
    // 检查是否已过截止时间
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    const deadlineTime = 23 * 60;
    const isAfterDeadline = currentTime >= deadlineTime;
    
    return {
      today: {
        date: today,
        totalInvested: pool.totalInvested,
        investorCount: pool.investorCount,
        unitPrice: pool.unitPrice,
        issuedCoins: pool.issuedCoins,
        status: pool.status,
        circulatingPoints: pool.circulatingPoints,
        isAfterDeadline: isAfterDeadline
      },
      exchangeRate: exchangeRate,
      priceHistory: priceHistory,
      baseParams: {
        basePrice: BASE_PRICE,
        baseCirculation: BASE_CIRCULATION,
        baseUsers: BASE_USERS,
        minInvestment: MIN_INVESTMENT,
        maxInvestment: MAX_INVESTMENT,
        exchangeFee: EXCHANGE_FEE,
        maxDailyInvestments: MAX_DAILY_INVESTMENTS,
        minCoinsThreshold: MIN_COINS_THRESHOLD
      }
    };
  }
  
  /**
   * 获取详细价格走势（用于图表页面）
   */
  static async getDetailedPriceChart(days = 30) {
    const histories = await PriceHistory.find()
      .sort({ date: -1 })
      .limit(days)
      .lean();
    
    const sortedHistories = histories.reverse();
    
    const prices = sortedHistories.map(h => h.unitPrice);
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    
    const totalIssued = sortedHistories.reduce((sum, h) => sum + (h.issuedCoins || 0), 0);
    const totalInvested = sortedHistories.reduce((sum, h) => sum + (h.totalInvested || 0), 0);
    
    return {
      history: sortedHistories,
      stats: {
        maxPrice,
        minPrice,
        avgPrice: Math.round(avgPrice * 100) / 100,
        totalIssued: Math.round(totalIssued * 100) / 100,
        totalInvested,
        days: sortedHistories.length
      }
    };
  }
}

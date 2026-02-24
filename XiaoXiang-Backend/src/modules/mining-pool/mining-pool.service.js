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
    
    return pool;
  }
  
  /**
   * 获取用户今日投入情况
   */
  static async getUserTodayInvestment(userId) {
    const today = this.getTodayString();
    
    const investment = await UserInvestment.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      date: today
    });
    
    return investment;
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
   * 用户投入积分
   */
  static async invest(userId, amount) {
    const today = this.getTodayString();
    
    // 1. 检查矿池状态
    let pool = await this.getTodayPool();
    
    if (pool.status !== 'open') {
      throw new Error('今日矿池已锁定，无法投入');
    }
    
    // 2. 检查投入金额
    if (amount < MIN_INVESTMENT) {
      throw new Error(`最小投入金额为 ${MIN_INVESTMENT} 积分`);
    }
    
    // 3. 检查用户今日已投入金额
    const existingInvestment = await UserInvestment.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      date: today
    });
    
    const todayInvested = existingInvestment?.amount || 0;
    if (todayInvested + amount > MAX_INVESTMENT) {
      throw new Error(`每人每日最大投入 ${MAX_INVESTMENT} 积分`);
    }
    
    // 4. 检查用户积分余额
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.points < amount) {
      throw new Error('积分不足');
    }
    
    // 5. 扣除用户积分
    user.points -= amount;
    await user.save();
    
    // 6. 记录交易
    await Transaction.create({
      userId: user._id,
      type: 'mining_invest',
      amount: amount,
      balanceSnapshot: user.points,
      description: '矿池投入',
      status: 'completed'
    });
    
    // 7. 更新矿池数据
    const isNewInvestor = !existingInvestment;
    
    if (existingInvestment) {
      existingInvestment.amount += amount;
      await existingInvestment.save();
    } else {
      await UserInvestment.create({
        userId: userId,
        date: today,
        amount: amount,
        estimatedCoins: 0
      });
    }
    
    // 8. 更新矿池统计
    pool.totalInvested += amount;
    pool.burnedPoints += amount;
    if (isNewInvestor) {
      pool.investorCount += 1;
    }
    pool.circulatingPoints -= amount;
    await pool.save();
    
    // 9. 重新计算单价和预计收益
    const newPrice = this.calculateUnitPrice(pool);
    const estimatedCoins = amount / newPrice;
    
    // 10. 更新预计收益
    if (existingInvestment) {
      existingInvestment.estimatedCoins = estimatedCoins;
      await existingInvestment.save();
    } else {
      await UserInvestment.updateOne(
        { userId: userId, date: today },
        { estimatedCoins: estimatedCoins }
      );
    }
    
    // 11. 更新矿池单价
    pool.unitPrice = newPrice;
    pool.issuedCoins = pool.totalInvested / newPrice;
    await pool.save();
    
    // 12. 获取用户名
    const userName = user.name || '小象用户';
    
    // 🆕 13. 发送投入成功通知
    try {
      const { NotificationService } = await import('../notifications/notification.service.js');
      await NotificationService.createAndSend(
        userId,
        '矿池投入成功',
        `亲爱的小象，您今日投入 ${amount} 积分，预计获得 ${estimatedCoins.toFixed(2)} 小象币，可到休闲大厅个人中心部分进行查看哦！`,
        'mining',
        { 
          action: 'view_mining', 
          amount: amount, 
          estimatedCoins: estimatedCoins,
          userName: userName
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
      totalInvested: existingInvestment ? todayInvested + amount : amount,
      estimatedCoins: estimatedCoins,
      currentPrice: newPrice,
      poolTotalInvested: pool.totalInvested,
      poolTotalCoins: pool.issuedCoins
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
   * 23:00 锁定矿池
   */
  static async lockPool() {
    const today = this.getTodayString();
    const pool = await MiningPoolDay.findOne({ date: today });
    
    if (!pool || pool.status !== 'open') {
      console.log(`[MiningPool] 今日矿池无需锁定`);
      return;
    }
    
    pool.status = 'locked';
    
    const finalPrice = this.calculateUnitPrice(pool);
    pool.unitPrice = finalPrice;
    pool.issuedCoins = pool.totalInvested / finalPrice;
    pool.tomorrowExchangeRate = finalPrice;
    
    await pool.save();
    
    console.log(`[MiningPool] 🔒 矿池已锁定，单价: ${finalPrice}, 发行: ${pool.issuedCoins.toFixed(2)} 小象币`);
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
          // 1. 增加用户小象币
          await User.findByIdAndUpdate(inv.userId._id, {
            $inc: { coins: inv.actualCoins }
          });
          
          // 2. 记录交易
          await Transaction.create({
            userId: inv.userId._id,
            type: 'mining_reward',
            amount: inv.actualCoins,
            description: `矿池收益：投入${inv.amount}积分`,
            status: 'completed'
          });
          
          // 3. 获取用户名
          const userName = inv.userId?.name || '小象用户';
          
          // 🆕 4. 发送到账通知
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
   * 获取用户投入历史
   */
  static async getUserInvestmentHistory(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [investments, total] = await Promise.all([
      UserInvestment.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserInvestment.countDocuments({ userId: new mongoose.Types.ObjectId(userId) })
    ]);
    
    return {
      investments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
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
    
    return {
      today: {
        date: today,
        totalInvested: pool.totalInvested,
        investorCount: pool.investorCount,
        unitPrice: pool.unitPrice,
        issuedCoins: pool.issuedCoins,
        status: pool.status,
        circulatingPoints: pool.circulatingPoints
      },
      exchangeRate: exchangeRate,
      priceHistory: priceHistory,
      baseParams: {
        basePrice: BASE_PRICE,
        baseCirculation: BASE_CIRCULATION,
        baseUsers: BASE_USERS,
        minInvestment: MIN_INVESTMENT,
        maxInvestment: MAX_INVESTMENT,
        exchangeFee: EXCHANGE_FEE
      }
    };
  }
}

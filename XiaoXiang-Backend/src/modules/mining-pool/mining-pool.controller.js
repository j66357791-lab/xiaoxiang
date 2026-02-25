import { success, error } from '../../common/utils/response.js';
import { MiningPoolService } from './mining-pool.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

// 内存缓存
let cachedOverview = null;
let cachedOverviewTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15分钟

// 🆕 高并发保护
let requestCount = 0;
let lastResetTime = Date.now();
let isCooldown = false;
let cooldownEndTime = 0;
const REQUEST_THRESHOLD = 100; // 100个请求触发冷却
const COOLDOWN_DURATION = 5 * 60 * 1000; // 5分钟冷却
const RESET_INTERVAL = 60 * 1000; // 1分钟重置计数

export class MiningPoolController {
  
  /**
   * 检查是否在冷却期
   */
  static checkCooldown() {
    const now = Date.now();
    
    // 检查是否在冷却期
    if (isCooldown) {
      const remainingTime = Math.ceil((cooldownEndTime - now) / 1000);
      if (remainingTime > 0) {
        return { inCooldown: true, remainingTime };
      } else {
        // 冷却结束，重置状态
        isCooldown = false;
        requestCount = 0;
        lastResetTime = now;
      }
    }
    
    // 每分钟重置计数
    if (now - lastResetTime > RESET_INTERVAL) {
      requestCount = 0;
      lastResetTime = now;
    }
    
    return { inCooldown: false, remainingTime: 0 };
  }
  
  /**
   * 获取矿池概览（带缓存）
   */
  static getOverview = asyncHandler(async (req, res) => {
    const now = Date.now();
    
    if (cachedOverview && (now - cachedOverviewTime) < CACHE_DURATION) {
      console.log('[MiningPool] 📦 使用缓存数据');
      return success(res, cachedOverview, '获取矿池概览成功（缓存）');
    }
    
    const overview = await MiningPoolService.getPoolOverview();
    
    cachedOverview = overview;
    cachedOverviewTime = now;
    
    console.log('[MiningPool] 🔄 更新缓存数据');
    return success(res, overview, '获取矿池概览成功');
  });
  
  /**
   * 获取今日矿池状态
   */
  static getTodayPool = asyncHandler(async (req, res) => {
    const pool = await MiningPoolService.getTodayPool();
    return success(res, pool, '获取今日矿池成功');
  });
  
  /**
   * 获取用户今日投入
   */
  static getUserInvestment = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const investment = await MiningPoolService.getUserTodayInvestment(userId);
    return success(res, investment, '获取用户投入成功');
  });
  
  /**
   * 投入积分（带高并发保护）
   */
  static invest = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的投入金额', 400);
    }
    
    // 🆕 检查冷却状态
    const cooldownStatus = this.checkCooldown();
    
    if (cooldownStatus.inCooldown) {
      console.log(`[MiningPool] 🚫 系统冷却中，拒绝请求。剩余 ${cooldownStatus.remainingTime} 秒`);
      return res.status(429).json({
        success: false,
        message: '系统繁忙，请稍后重试',
        data: {
          inCooldown: true,
          remainingTime: cooldownStatus.remainingTime,
          cooldownType: 'high_traffic'
        }
      });
    }
    
    // 🆕 增加请求计数
    requestCount++;
    console.log(`[MiningPool] 📊 当前请求计数: ${requestCount}/${REQUEST_THRESHOLD}`);
    
    // 🆕 检查是否超过阈值
    if (requestCount >= REQUEST_THRESHOLD) {
      // 进入冷却期
      isCooldown = true;
      cooldownEndTime = Date.now() + COOLDOWN_DURATION;
      
      console.log(`[MiningPool] ⚠️ 请求超过阈值 ${REQUEST_THRESHOLD}，进入冷却期 5 分钟`);
      
      // 5分钟后自动重置
      setTimeout(() => {
        isCooldown = false;
        requestCount = 0;
        lastResetTime = Date.now();
        console.log('[MiningPool] ✅ 冷却期结束，恢复正常');
      }, COOLDOWN_DURATION);
      
      return res.status(429).json({
        success: false,
        message: '系统繁忙，请5分钟后重试',
        data: {
          inCooldown: true,
          remainingTime: 300,
          cooldownType: 'high_traffic'
        }
      });
    }
    
    try {
      const result = await MiningPoolService.invest(userId, amount);
      
      // 清除缓存
      cachedOverview = null;
      
      // 🆕 返回剩余请求配额
      result.requestQuota = {
        used: requestCount,
        total: REQUEST_THRESHOLD,
        remaining: REQUEST_THRESHOLD - requestCount
      };
      
      return success(res, result, '投入成功');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });
  
  /**
   * 小象币兑换积分
   */
  static exchangeCoins = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { coins } = req.body;
    
    if (!coins || coins <= 0) {
      return error(res, '请输入有效的兑换数量', 400);
    }
    
    try {
      const result = await MiningPoolService.exchangeCoinsToPoints(userId, coins);
      
      cachedOverview = null;
      
      return success(res, result, '兑换成功');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });
  
  /**
   * 获取价格历史
   */
  static getPriceHistory = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const history = await MiningPoolService.getPriceHistory(parseInt(days));
    return success(res, history, '获取价格历史成功');
  });
  
  /**
   * 获取用户投入历史
   */
  static getUserHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await MiningPoolService.getUserInvestmentHistory(userId, page, limit);
    return success(res, result, '获取投入历史成功');
  });
  
  /**
   * 获取当前兑换价格
   */
  static getExchangeRate = asyncHandler(async (req, res) => {
    const rate = await MiningPoolService.getCurrentExchangeRate();
    return success(res, { exchangeRate: rate }, '获取兑换价格成功');
  });
  
  /**
   * 获取详细价格走势
   */
  static getDetailedPriceChart = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const chartData = await MiningPoolService.getDetailedPriceChart(parseInt(days));
    return success(res, chartData, '获取价格走势成功');
  });
  
  /**
   * 🆕 获取系统状态（用于前端检查冷却状态）
   */
  static getSystemStatus = asyncHandler(async (req, res) => {
    const cooldownStatus = this.checkCooldown();
    
    return success(res, {
      inCooldown: cooldownStatus.inCooldown,
      remainingTime: cooldownStatus.remainingTime,
      requestCount: requestCount,
      requestThreshold: REQUEST_THRESHOLD,
      isAfterDeadline: this.checkDeadline()
    }, '获取系统状态成功');
  });
  
  /**
   * 检查是否已过截止时间
   */
  static checkDeadline() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 23;
  }
}

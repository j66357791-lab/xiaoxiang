import { success, error } from '../../common/utils/response.js';
import { MiningPoolService } from './mining-pool.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class MiningPoolController {
  
  /**
   * 获取矿池概览
   */
  static getOverview = asyncHandler(async (req, res) => {
    const overview = await MiningPoolService.getPoolOverview();
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
   * 投入积分
   */
  static invest = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的投入金额', 400);
    }
    
    const result = await MiningPoolService.invest(userId, amount);
    return success(res, result, '投入成功');
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
    
    const result = await MiningPoolService.exchangeCoinsToPoints(userId, coins);
    return success(res, result, '兑换成功');
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
}

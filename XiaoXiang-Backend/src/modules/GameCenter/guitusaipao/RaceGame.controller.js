// src/modules/GameCenter/guitusaipao/RaceGame.controller.js
import { RaceGameManager } from './RaceGame.service.js';
import { success, error } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export class RaceGameController {
  
  static getState = asyncHandler(async (req, res) => {
    const state = RaceGameManager.getCurrentState();
    return success(res, state, '获取成功');
  });
  
  static placeBet = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { side, amount } = req.body;
    
    if (!side || !['turtle', 'rabbit'].includes(side)) {
      return error(res, '请选择正确的下注方', 400);
    }
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的下注金额', 400);
    }
    
    try {
      const result = await RaceGameManager.placeBet(userId, side, amount);
      return success(res, result, '下注成功');
    } catch (err) {
      return error(res, err.message, 400);
    }
  });
  
  static getHistory = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const history = await RaceGameManager.getHistory(limit);
    return success(res, history, '获取成功');
  });
  
  static getUserHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;
    const history = await RaceGameManager.getUserBetHistory(userId, limit);
    return success(res, history, '获取成功');
  });
  
  static getPoolStats = asyncHandler(async (req, res) => {
    const poolStats = RaceGameManager.getPoolStats();
    return success(res, poolStats, '获取成功');
  });
}

// src/modules/GameCenter/flipcard/FlipCard.controller.js
// 优化版本：添加游戏结果上报接口
import { FlipCardService } from './FlipCard.service.js';
import { success, error } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export class FlipCardController {
  
  /**
   * 开始游戏 - 购买门票
   * 🆕 返回乌龟位置，前端本地判断
   */
  static start = asyncHandler(async (req, res) => {
    const { levelId, bet } = req.body;
    
    if (!bet || bet <= 0) {
      return error(res, '请选择有效的下注金额', 400);
    }
    
    const result = await FlipCardService.startGame(req.user.id, levelId, bet);
    return success(res, result, '游戏开始');
  });

  /**
   * 翻牌
   * 🆕 保留此接口用于验证或兼容旧版本
   */
  static flip = asyncHandler(async (req, res) => {
    const { gameId, cardIndex } = req.body;
    
    if (!gameId || cardIndex === undefined) {
      return error(res, '请提供游戏ID和卡片索引', 400);
    }
    
    const result = await FlipCardService.flipCard(req.user.id, gameId, cardIndex);
    return success(res, result, '翻牌成功');
  });

  /**
   * 🆕 游戏结果上报
   * 前端本地判断后，异步上报结果给后端
   */
  static reportResult = asyncHandler(async (req, res) => {
    const { gameId, result, turtleIndex, finalScore, flippedCards } = req.body;
    
    if (!gameId || !result) {
      return error(res, '请提供游戏ID和结果', 400);
    }
    
    if (!['win', 'lose'].includes(result)) {
      return error(res, '无效的结果类型', 400);
    }
    
    const resultData = await FlipCardService.reportResult(
      req.user.id,
      gameId,
      result,
      turtleIndex,
      finalScore,
      flippedCards
    );
    
    return success(res, resultData, '结果上报成功');
  });

  /**
   * 手动结算
   */
  static settle = asyncHandler(async (req, res) => {
    const { gameId } = req.body;
    
    if (!gameId) {
      return error(res, '请提供游戏ID', 400);
    }
    
    const result = await FlipCardService.settleGame(req.user.id, gameId);
    
    // 返回结算详情
    return success(res, {
      message: '结算成功',
      totalScore: result.totalScore,      // 获得积分
      fee: result.fee,                    // 手续费
      actualReward: result.actualReward,  // 实际获得
      newBalance: result.newBalance
    }, '结算成功');
  });

  /**
   * 获取游戏详情
   */
  static getDetail = asyncHandler(async (req, res) => {
    const { gameId } = req.params;
    const result = await FlipCardService.getGameDetail(req.user.id, gameId);
    return success(res, result, '获取成功');
  });
}

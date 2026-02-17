// src/modules/gamescaiquan/gamescaiquan.controller.js
import { success, error, paginated } from '../../common/utils/response.js';
import { GameScaiquanService } from './gamescaiquan.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class GameScaiquanController {
  /**
   * 获取等待中的对局列表
   */
  static getWaitingGames = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const games = await GameScaiquanService.getWaitingGames(userId);
    return success(res, games, '获取对局列表成功');
  });

  /**
   * 创建对局
   */
  static createGame = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { stake, hand } = req.body;

    if (!stake || !hand) {
      return error(res, '请提供赌注和手势', 400);
    }

    const result = await GameScaiquanService.createGame(userId, stake, hand);
    return success(res, result, '对局创建成功');
  });

  /**
   * 加入对局
   */
  static joinGame = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { gameId, hand } = req.body;

    if (!gameId || !hand) {
      return error(res, '请提供对局ID和手势', 400);
    }

    const result = await GameScaiquanService.joinGame(userId, gameId, hand);
    return success(res, result, '加入对局成功');
  });

  /**
   * 取消对局
   */
  static cancelGame = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { gameId } = req.params;

    const result = await GameScaiquanService.cancelGame(userId, gameId);
    return success(res, result, '对局已取消');
  });

  /**
   * 获取我的对局记录
   */
  static getMyGames = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await GameScaiquanService.getMyGames(userId, page, limit);
    return paginated(res, result.games, result);
  });

  /**
   * 获取我创建的等待中对局
   */
  static getMyWaitingGame = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const game = await GameScaiquanService.getMyWaitingGame(userId);
    return success(res, game, '获取成功');
  });
}

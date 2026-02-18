// server/src/modules/GameCenter/stats/GameStats.controller.js
import { GameStatsService } from './GameStats.service.js';
import { success, error } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export class GameStatsController {
  
  static getOverview = asyncHandler(async (req, res) => {
    const stats = await GameStatsService.getGamesOverview();
    return success(res, stats, '获取游戏总览成功');
  });

  static getDetails = asyncHandler(async (req, res) => {
    const details = await GameStatsService.getGamesDetail();
    return success(res, details, '获取游戏详情成功');
  });

  static getGameDetail = asyncHandler(async (req, res) => {
    const { gameKey } = req.params;
    const { days = 30 } = req.query;
    
    try {
      const detail = await GameStatsService.getGameDetail(gameKey, parseInt(days));
      return success(res, detail, '获取游戏详情成功');
    } catch (err) {
      return error(res, err.message, 404);
    }
  });
}

import { FlipCardService } from './FlipCard.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export class FlipCardController {
  static start = asyncHandler(async (req, res) => {
    const { levelId, bet } = req.body;
    const result = await FlipCardService.startGame(req.user.id, levelId, bet);
    return success(res, result, '游戏开始');
  });

  static flip = asyncHandler(async (req, res) => {
    const { gameId, cardIndex } = req.body;
    const result = await FlipCardService.flipCard(req.user.id, gameId, cardIndex);
    return success(res, result, '翻牌成功');
  });

  static settle = asyncHandler(async (req, res) => {
    const { gameId } = req.body;
    const reward = await FlipCardService.settleGame(req.user.id, gameId);
    return success(res, { reward }, '结算成功');
  });
}

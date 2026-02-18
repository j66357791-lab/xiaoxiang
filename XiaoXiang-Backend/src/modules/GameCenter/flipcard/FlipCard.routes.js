// src/modules/GameCenter/flipcard/FlipCard.routes.js
import { Router } from 'express';
import { authenticate } from '../../../common/middlewares/auth.js';
import { FlipCardController } from './FlipCard.controller.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 翻牌游戏接口
// =====================

// 开始游戏 - 购买门票
router.post('/start', authenticate, asyncHandler(FlipCardController.start));

// 翻牌
router.post('/flip', authenticate, asyncHandler(FlipCardController.flip));

// 手动结算
router.post('/settle', authenticate, asyncHandler(FlipCardController.settle));

// 获取游戏详情
router.get('/:gameId', authenticate, asyncHandler(FlipCardController.getDetail));

export default router;

// src/modules/GameCenter/flipcard/FlipCard.routes.js
// 优化版本：添加游戏结果上报路由
import { Router } from 'express';
import { authenticate } from '../../../common/middlewares/auth.js';
import { FlipCardController } from './FlipCard.controller.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 翻牌游戏接口
// =====================

// 开始游戏 - 购买门票
// 🆕 返回乌龟位置，前端本地判断
router.post('/start', authenticate, asyncHandler(FlipCardController.start));

// 翻牌（保留用于验证或兼容旧版本）
router.post('/flip', authenticate, asyncHandler(FlipCardController.flip));

// 🆕 游戏结果上报（前端本地判断后上报）
router.post('/result', authenticate, asyncHandler(FlipCardController.reportResult));

// 手动结算
router.post('/settle', authenticate, asyncHandler(FlipCardController.settle));

// 获取游戏详情
router.get('/:gameId', authenticate, asyncHandler(FlipCardController.getDetail));

export default router;

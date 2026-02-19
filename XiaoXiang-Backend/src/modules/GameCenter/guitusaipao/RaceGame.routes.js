// src/modules/GameCenter/guitusaipao/RaceGame.routes.js
import { Router } from 'express';
import { RaceGameController } from './RaceGame.controller.js';
import { authenticate } from '../../../common/middlewares/auth.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

const router = Router();

// 公开路由
router.get('/state', asyncHandler(RaceGameController.getState));
router.get('/history', asyncHandler(RaceGameController.getHistory));
router.get('/pool', asyncHandler(RaceGameController.getPoolStats));

// 需要认证的路由
router.post('/bet', authenticate, asyncHandler(RaceGameController.placeBet));
router.get('/my-bets', authenticate, asyncHandler(RaceGameController.getUserHistory));

export default router;

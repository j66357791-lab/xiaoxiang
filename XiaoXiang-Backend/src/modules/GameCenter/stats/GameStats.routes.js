// server/src/modules/GameCenter/stats/GameStats.routes.js
import { Router } from 'express';
import { GameStatsController } from './GameStats.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const gameStatsRoutes = Router();

gameStatsRoutes.get('/overview', authenticate, authorize('admin', 'superAdmin'), asyncHandler(GameStatsController.getOverview));
gameStatsRoutes.get('/details', authenticate, authorize('admin', 'superAdmin'), asyncHandler(GameStatsController.getDetails));
gameStatsRoutes.get('/:gameKey', authenticate, authorize('admin', 'superAdmin'), asyncHandler(GameStatsController.getGameDetail));

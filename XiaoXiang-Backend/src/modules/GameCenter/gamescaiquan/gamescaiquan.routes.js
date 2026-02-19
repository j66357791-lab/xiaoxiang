// src/modules/gamescaiquan/gamescaiquan.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import { GameScaiquanController } from './gamescaiquan.controller.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 猜拳游戏接口
// =====================

// 获取等待中的对局列表
router.get('/waiting', authenticate, asyncHandler(GameScaiquanController.getWaitingGames));

// 获取我创建的等待中对局
router.get('/my-waiting', authenticate, asyncHandler(GameScaiquanController.getMyWaitingGame));

// 获取我的对局记录
router.get('/my-games', authenticate, asyncHandler(GameScaiquanController.getMyGames));

// 获取手续费统计（管理员）
router.get('/stats/fee', authenticate, authorize('admin', 'superAdmin'), asyncHandler(GameScaiquanController.getFeeStats));

// 创建对局
router.post('/create', authenticate, asyncHandler(GameScaiquanController.createGame));

// 加入对局
router.post('/join', authenticate, asyncHandler(GameScaiquanController.joinGame));

// 取消对局
router.delete('/:gameId', authenticate, asyncHandler(GameScaiquanController.cancelGame));

export default router;

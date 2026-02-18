// src/modules/GameCenter/wheel5600/WheelGame.routes.js
import { Router } from 'express';
import { 
  startGame, 
  spinWheel, 
  getJackpot, 
  getHistory, 
  verifyGame,
  getBetOptions,
  getJackpotWinners,
  getCurrentGame  // 👈 新增导入
} from './WheelGame.controller.js';
import { authenticate } from '../../../common/middlewares/auth.js';

const router = Router();

// 公开路由
router.get('/jackpot', getJackpot);
router.get('/winners', getJackpotWinners);

// 需要认证的路由
router.get('/current', authenticate, getCurrentGame);  // 👈 新增路由
router.post('/start', authenticate, startGame);
router.post('/spin', authenticate, spinWheel);
router.get('/history', authenticate, getHistory);
router.get('/verify/:gameId', authenticate, verifyGame);
router.get('/bet-options', getBetOptions);

export default router;

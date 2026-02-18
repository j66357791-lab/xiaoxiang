// src/modules/WheelGame/WheelGame.routes.js
import { Router } from 'express';
import { 
  startGame, 
  spinWheel, 
  getJackpot, 
  getHistory, 
  verifyGame 
} from './WheelGame.controller.js';
import { authenticate } from '../../common/middlewares/auth.js'; // ✅ 修正路径

const router = Router();

// 公开路由
router.get('/jackpot', getJackpot);

// 需要认证的路由
router.post('/start', authenticate, startGame);
router.post('/spin', authenticate, spinWheel);
router.get('/history', authenticate, getHistory);
router.get('/verify/:gameId', authenticate, verifyGame);

export default router;

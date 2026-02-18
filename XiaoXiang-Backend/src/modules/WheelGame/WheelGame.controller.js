// src/WheelGame/WheelGame.controller.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import WheelGame from './WheelGame.models.js';
import Jackpot from './Jackpot.models.js';
import { ROUNDS_CONFIG, GAME_CONFIG } from './WheelGame.config.js';
import User from '../users/user.model.js'; // ✅ 修正路径：同级 modules

// ==================== 辅助函数 ====================

// 生成加密安全的随机数
const secureRandom = (max) => {
  const bytes = crypto.randomBytes(4);
  const randomValue = bytes.readUInt32LE(0);
  return randomValue % max;
};

// 生成游戏ID
const generateGameId = () => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `WHEEL-${timestamp}-${random}`.toUpperCase();
};

// 生成服务器种子
const generateServerSeed = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ==================== 控制器 ====================

/**
 * 开始新游戏
 * POST /api/games/wheel5600/start
 */
export const startGame = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user.id;
    const { ticketPrice = GAME_CONFIG.TICKET_PRICE } = req.body;
    
    console.log(`[Wheel5600] 用户 ${userId} 尝试开始游戏`);
    
    // 1. 检查用户余额
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    if (user.points < ticketPrice) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: '积分不足，需要10积分才能开始游戏' 
      });
    }
    
    // 2. 检查是否有未完成的游戏
    const activeGame = await WheelGame.findOne({ 
      userId, 
      status: 'active' 
    }).session(session);
    
    if (activeGame) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: '已有进行中的游戏',
        data: { gameId: activeGame.gameId, currentRound: activeGame.currentRound }
      });
    }
    
    // 3. 扣除门票（门票全额进入奖池）
    user.points -= ticketPrice;
    await user.save({ session });
    
    // 4. 更新奖池 - 门票全额入奖池
    let jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
    if (!jackpot) {
      jackpot = new Jackpot({ gameType: 'wheel5600', amount: 0 });
    }
    jackpot.amount += ticketPrice; // ✅ 门票全额入奖池
    jackpot.totalGames += 1;
    await jackpot.save({ session });
    
    // 5. 创建新游戏
    const game = new WheelGame({
      userId,
      gameId: generateGameId(),
      ticketPrice,
      currentPoints: ticketPrice, // 初始积分 = 门票
      currentRound: 0,
      serverSeed: generateServerSeed(),
      status: 'active'
    });
    
    await game.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      data: {
        gameId: game.gameId,
        balance: user.points,
        initialPoints: ticketPrice,
        currentRound: 0
      }
    });
    
    console.log(`[Wheel5600] ✅ 游戏 ${game.gameId} 开始，门票 ${ticketPrice} 已入奖池`);
    
  } catch (error) {
    await session.abortTransaction();
    console.error('[Wheel5600] ❌ 开始游戏错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  } finally {
    session.endSession();
  }
};

/**
 * 旋转转盘
 * POST /api/games/wheel5600/spin
 */
export const spinWheel = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user.id;
    const { round } = req.body;
    
    // 1. 获取当前游戏
    const game = await WheelGame.findOne({ 
      userId, 
      status: 'active' 
    }).session(session);
    
    if (!game) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: '没有进行中的游戏，请先开始游戏' 
      });
    }
    
    if (game.currentRound !== round) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: '轮次不匹配，请刷新页面' 
      });
    }
    
    // 2. 获取轮盘配置
    const roundConfig = ROUNDS_CONFIG[round];
    if (!roundConfig) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: '无效的轮次' 
      });
    }
    
    // 3. ✅ 生成随机结果（后端计算，加密安全随机数）
    const sectorIndex = secureRandom(roundConfig.sectors.length);
    const sector = roundConfig.sectors[sectorIndex];
    
    console.log(`[Wheel5600] 游戏 ${game.gameId} 第${round+1}圈 随机结果: 扇区${sectorIndex}, 类型:${sector.type}`);
    
    // 4. 处理结果
    let newPoints = game.currentPoints;
    let newRound = game.currentRound;
    let gameEnded = false;
    let jackpotChange = 0;
    let message = '';
    let status = 'active';
    
    const pointsBefore = game.currentPoints;
    
    if (sector.type === 'multiplier') {
      // 倍率扇区
      newPoints = game.currentPoints * sector.value;
      newRound = round + 1;
      message = `倍率 ${sector.value}x，积分变为 ${newPoints.toFixed(2)}`;
      
    } else if (sector.type === 'death') {
      // ✅ 死亡扇区：只损失门票（已在开始时入奖池），无额外手续费
      gameEnded = true;
      status = 'died';
      newPoints = 0;
      message = '💀 死亡！门票10积分已入奖池，无额外损失';
      
    } else if (sector.type === 'settle') {
      // ✅ 结算扇区：5%手续费入奖池，95%给用户
      const fee = game.currentPoints * GAME_CONFIG.SETTLE_FEE_RATE;
      const gain = game.currentPoints * (1 - GAME_CONFIG.SETTLE_FEE_RATE);
      
      jackpotChange = fee; // 手续费入奖池
      newPoints = 0;
      gameEnded = true;
      status = 'settled';
      message = `🏁 结算！手续费 ${fee.toFixed(2)} 入奖池，获得 ${gain.toFixed(2)} 积分`;
      
      // 更新用户余额
      const user = await User.findById(userId).session(session);
      user.points += gain;
      await user.save({ session });
      
    } else if (sector.type === 'jackpot') {
      // ✅ 奖池扇区：获得奖池百分比
      const jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
      const winAmount = jackpot.amount * sector.value;
      
      // 从奖池扣除
      jackpot.amount -= winAmount;
      jackpot.totalWins += 1;
      jackpot.lastWinAmount = winAmount;
      jackpot.lastWinUserId = userId;
      jackpot.lastWinAt = new Date();
      await jackpot.save({ session });
      
      // 记录奖池变化（负数表示扣除）
      jackpotChange = -winAmount;
      
      gameEnded = true;
      status = 'completed';
      message = `🏆 恭喜！获得奖池 ${(sector.value * 100).toFixed(0)}% = ${winAmount.toFixed(2)} 积分！`;
      
      // 更新用户余额（当前积分 + 奖池奖励）
      const user = await User.findById(userId).session(session);
      user.points += game.currentPoints + winAmount;
      await user.save({ session });
    }
    
    // 5. 记录旋转历史
    game.spinHistory.push({
      round: game.currentRound,
      sectorIndex,
      sectorType: sector.type,
      sectorValue: sector.value || 0,
      pointsBefore,
      pointsAfter: newPoints,
      timestamp: new Date()
    });
    
    // 6. 更新游戏状态
    game.currentPoints = newPoints;
    game.currentRound = newRound;
    game.nonce += 1;
    
    if (gameEnded) {
      game.status = status;
      game.endedAt = new Date();
      game.result = {
        type: sector.type,
        finalPoints: newPoints,
        feePaid: sector.type === 'settled' ? pointsBefore * GAME_CONFIG.SETTLE_FEE_RATE : 0,
        jackpotWon: sector.type === 'jackpot' ? Math.abs(jackpotChange) : 0
      };
    }
    
    await game.save({ session });
    
    // 7. 更新奖池（手续费）
    if (jackpotChange > 0) {
      const jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
      jackpot.amount += jackpotChange;
      await jackpot.save({ session });
    }
    
    await session.commitTransaction();
    
    // 8. 返回结果
    const user = await User.findById(userId);
    
    res.json({
      success: true,
      data: {
        sectorIndex,
        sectorType: sector.type,
        sectorValue: sector.value || 0,
        newPoints,
        newRound,
        gameEnded,
        balance: user.points,
        jackpotChange,
        message
      }
    });
    
    console.log(`[Wheel5600] 游戏 ${game.gameId} 第${round+1}圈结果: ${sector.type} ${sector.value || ''}, 游戏状态: ${status}`);
    
  } catch (error) {
    await session.abortTransaction();
    console.error('[Wheel5600] ❌ 旋转错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  } finally {
    session.endSession();
  }
};

/**
 * 获取奖池信息
 * GET /api/games/wheel5600/jackpot
 */
export const getJackpot = async (req, res) => {
  try {
    const jackpot = await Jackpot.findOne({ gameType: 'wheel5600' });
    
    res.json({
      success: true,
      data: {
        jackpot: jackpot?.amount || 0,
        totalGames: jackpot?.totalGames || 0,
        totalWins: jackpot?.totalWins || 0,
        lastWinAmount: jackpot?.lastWinAmount || 0,
        lastWinAt: jackpot?.lastWinAt
      }
    });
  } catch (error) {
    console.error('[Wheel5600] 获取奖池错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

/**
 * 获取游戏历史
 * GET /api/games/wheel5600/history
 */
export const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    
    const games = await WheelGame.find({ userId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .select('gameId status currentPoints startedAt endedAt result');
    
    res.json({
      success: true,
      data: { games }
    });
  } catch (error) {
    console.error('[Wheel5600] 获取历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

/**
 * 验证游戏公平性
 * GET /api/games/wheel5600/verify/:gameId
 */
export const verifyGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;
    
    const game = await WheelGame.findOne({ gameId, userId });
    if (!game) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    res.json({
      success: true,
      data: {
        gameId: game.gameId,
        serverSeed: game.serverSeed,
        spinHistory: game.spinHistory,
        result: game.result
      }
    });
  } catch (error) {
    console.error('[Wheel5600] 验证错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

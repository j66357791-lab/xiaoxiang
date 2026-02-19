// src/modules/GameCenter/wheel5600/WheelGame.controller.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import WheelGame from './WheelGame.models.js';
import Jackpot from './Jackpot.models.js';
import { ROUNDS_CONFIG, GAME_CONFIG, BET_OPTIONS, isValidBet } from './WheelGame.config.js';
import User from '../../users/user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError } from '../../../common/utils/error.js';

// ==================== 辅助函数 ====================

const secureRandom = (max) => {
  const bytes = crypto.randomBytes(4);
  const randomValue = bytes.readUInt32LE(0);
  return randomValue % max;
};

const generateGameId = () => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `WHEEL-${timestamp}-${random}`.toUpperCase();
};

const generateServerSeed = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ==================== 控制器 ====================

export const startGame = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user.id;
    const { ticketPrice = 10 } = req.body;
    
    if (!isValidBet(ticketPrice)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: `无效的投注金额，请选择: ${BET_OPTIONS.join(', ')} 积分` 
      });
    }
    
    console.log(`[Wheel5600] 用户 ${userId} 尝试开始游戏，投注额: ${ticketPrice}`);
    
    const user = await User.findOne({ 
      _id: userId, 
      points: { $gte: ticketPrice } 
    }).session(session);
    
    if (!user) {
      await session.abortTransaction();
      const exists = await User.findById(userId);
      if (!exists) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }
      return res.status(400).json({ 
        success: false, 
        message: `积分不足，需要 ${ticketPrice} 积分才能开始游戏` 
      });
    }
    
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
    
    await User.findByIdAndUpdate(userId, { $inc: { points: -ticketPrice } }, { session });
    
    let jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
    if (!jackpot) {
      jackpot = new Jackpot({ gameType: 'wheel5600', amount: 0 });
    }
    jackpot.amount += ticketPrice;
    jackpot.totalGames += 1;
    await jackpot.save({ session });
    
    await Transaction.create([{
      userId,
      type: 'wheel_ticket',
      amount: ticketPrice,
      pointsSnapshot: user.points - ticketPrice,
      description: `转盘游戏门票（${ticketPrice}积分）`,
      status: 'completed'
    }], { session });
    
    const game = new WheelGame({
      userId,
      gameId: generateGameId(),
      ticketPrice,
      currentPoints: ticketPrice,
      currentRound: 0,
      serverSeed: generateServerSeed(),
      status: 'active'
    });
    
    await game.save({ session });
    
    await User.findByIdAndUpdate(
      userId,
      { 
        $inc: { 
          'mysteryShop.consumption': ticketPrice,
          'mysteryShop.totalConsumption': ticketPrice
        } 
      },
      { session }
    );
    
    await Transaction.create([{
      userId,
      type: 'mystery_shop_progress',
      amount: ticketPrice,
      pointsSnapshot: user.points - ticketPrice,
      description: `游戏消耗累计神秘商店进度`,
      status: 'completed'
    }], { session });
    
    await session.commitTransaction();
    
    const updatedUser = await User.findById(userId);
    
    res.json({
      success: true,
      data: {
        gameId: game.gameId,
        balance: updatedUser.points,
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

export const spinWheel = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user.id;
    const { round } = req.body;
    
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
    
    const roundConfig = ROUNDS_CONFIG[round];
    if (!roundConfig) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: '无效的轮次' 
      });
    }
    
    const sectorIndex = secureRandom(roundConfig.sectors.length);
    const sector = roundConfig.sectors[sectorIndex];
    
    console.log(`[Wheel5600] 游戏 ${game.gameId} 第${round+1}圈 随机结果: 扇区${sectorIndex}, 类型:${sector.type}`);
    
    let newPoints = game.currentPoints;
    let newRound = game.currentRound;
    let gameEnded = false;
    let jackpotChange = 0;
    let message = '';
    let status = 'active';
    
    const pointsBefore = game.currentPoints;
    
    if (sector.type === 'multiplier') {
      newPoints = game.currentPoints * sector.value;
      newRound = round + 1;
      message = `倍率 ${sector.value}x，积分变为 ${newPoints.toFixed(2)}`;
      
    } else if (sector.type === 'death') {
      gameEnded = true;
      status = 'died';
      newPoints = 0;
      message = '💀 死亡！门票已入奖池，无额外损失';
      
    } else if (sector.type === 'settle') {
      const fee = game.currentPoints * GAME_CONFIG.SETTLE_FEE_RATE;
      const gain = game.currentPoints * (1 - GAME_CONFIG.SETTLE_FEE_RATE);
      
      jackpotChange = fee;
      newPoints = 0;
      gameEnded = true;
      status = 'settled';
      message = `🏁 结算！手续费 ${fee.toFixed(2)} 入奖池，获得 ${gain.toFixed(2)} 积分`;
      
      await User.findByIdAndUpdate(userId, { $inc: { points: gain } }, { session });
      
      await Transaction.create([{
        userId,
        type: 'wheel_reward',
        amount: gain,
        description: `转盘结算获得 ${gain.toFixed(2)} 积分`,
        status: 'completed'
      }], { session });
      
      await Transaction.create([{
        userId,
        type: 'wheel_settle_fee',
        amount: fee,
        description: `转盘结算手续费 ${fee.toFixed(2)} 积分入奖池`,
        status: 'completed'
      }], { session });
      
    } else if (sector.type === 'jackpot') {
      const jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
      
      const jackpotExtract = jackpot.amount * sector.value;
      const totalWin = game.currentPoints + jackpotExtract;
      
      jackpot.amount -= jackpotExtract;
      jackpot.totalWins += 1;
      jackpot.lastWinAmount = totalWin;
      jackpot.lastWinUserId = userId;
      jackpot.lastWinAt = new Date();
      await jackpot.save({ session });
      
      jackpotChange = -jackpotExtract;
      
      gameEnded = true;
      status = 'completed';
      message = `🏆 恭喜！获得奖池 ${(sector.value * 100).toFixed(0)}%！\n本金 ${game.currentPoints.toFixed(2)} + 奖池 ${jackpotExtract.toFixed(2)} = ${totalWin.toFixed(2)} 积分！`;
      
      await User.findByIdAndUpdate(userId, { $inc: { points: totalWin } }, { session });
      
      await Transaction.create([{
        userId,
        type: 'wheel_jackpot',
        amount: totalWin,
        description: `第9圈大奖：本金${game.currentPoints.toFixed(2)} + 奖池${(sector.value*100).toFixed(0)}%(${jackpotExtract.toFixed(2)})`,
        status: 'completed'
      }], { session });
    }

    game.spinHistory.push({
      round: game.currentRound,
      sectorIndex,
      sectorType: sector.type,
      sectorValue: sector.value || 0,
      pointsBefore,
      pointsAfter: newPoints,
      timestamp: new Date()
    });
    
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
    
    if (jackpotChange > 0) {
      const jackpot = await Jackpot.findOne({ gameType: 'wheel5600' }).session(session);
      jackpot.amount += jackpotChange;
      await jackpot.save({ session });
    }
    
    await session.commitTransaction();
    
    const updatedUser = await User.findById(userId);
    
    res.json({
      success: true,
      data: {
        sectorIndex,
        sectorType: sector.type,
        sectorValue: sector.value || 0,
        newPoints,
        newRound,
        gameEnded,
        balance: updatedUser.points,
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

export const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    
    const games = await WheelGame.find({ userId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .select('gameId status currentPoints startedAt endedAt result ticketPrice');
    
    res.json({
      success: true,
      data: { games }
    });
  } catch (error) {
    console.error('[Wheel5600] 获取历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

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

export const getBetOptions = async (req, res) => {
  res.json({
    success: true,
    data: {
      options: BET_OPTIONS
    }
  });
};

export const getJackpotWinners = async (req, res) => {
  try {
    const winners = await WheelGame.aggregate([
      { $match: { 
        status: 'completed',
        'result.jackpotWon': { $gt: 0 } 
      }},
      { $sort: { endedAt: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          name: { 
            $concat: [
              { $substr: [{ $ifNull: ['$user.name', '$user.email'] }, 0, 3] }, 
              '***'
            ] 
          },
          amount: '$result.jackpotWon',
          time: '$endedAt'
        }
      }
    ]);

    res.json({
      success: true,
      data: winners
    });
  } catch (error) {
    console.error('[Wheel5600] 获取大奖名单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

export const getCurrentGame = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const game = await WheelGame.findOne({ 
      userId, 
      status: 'active' 
    });
    
    if (!game) {
      return res.json({
        success: true,
        data: {
          hasActiveGame: false
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        hasActiveGame: true,
        gameId: game.gameId,
        ticketPrice: game.ticketPrice,
        currentPoints: game.currentPoints,
        currentRound: game.currentRound,
        startedAt: game.startedAt
      }
    });
    
    console.log(`[Wheel5600] 用户 ${userId} 恢复游戏: ${game.gameId}, 第${game.currentRound + 1}圈, 积分: ${game.currentPoints}`);
    
  } catch (error) {
    console.error('[Wheel5600] 获取当前游戏错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// src/modules/GameCenter/guitusaipao/RaceGame.service.js
import mongoose from 'mongoose';
import { Race, Bet } from './RaceGame.models.js';
import User from '../../users/user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { 
  PHASE_DURATIONS, 
  BET_OPTIONS, 
  ODDS, 
  BASE_SPEED, 
  RACE_EVENTS,
  GAME_PHASES,
  TRANSACTION_TYPES 
} from './RaceGame.config.js';

// 全局游戏状态
let gameState = {
  currentRace: null,
  phase: null,
  phaseEndTime: null,
  raceEvents: [],
  turtlePosition: 0,
  rabbitPosition: 0,
  winner: null,
  animationFrames: [],
};

let phaseTimer = null;
let broadcastFn = null;
let sendToUserFn = null;

export const setBroadcastFunction = (fn) => { broadcastFn = fn; };
export const setSendToUserFunction = (fn) => { sendToUserFn = fn; };

const broadcast = (event, data) => {
  if (broadcastFn) broadcastFn(event, data);
};

const sendToUser = (userId, event, data) => {
  if (sendToUserFn) sendToUserFn(userId, event, data);
};

/**
 * 游戏管理器
 */
export class RaceGameManager {
  
  /**
   * 初始化游戏
   */
  static async initialize() {
    console.log('[RaceGame] 🎮 初始化龟兔赛跑游戏服务...');
    
    // 清理未完成的比赛
    const pendingRace = await Race.findOne({ status: { $ne: 'settled' } }).sort({ startedAt: -1 });
    if (pendingRace) {
      await Race.findByIdAndUpdate(pendingRace._id, { status: 'settled' });
    }
    
    // 开始第一局
    await this.startNewRace();
  }
  
  /**
   * 开始新一轮比赛
   */
  static async startNewRace() {
    try {
      // 获取下一局序号（从1开始）
      const lastRace = await Race.findOne().sort({ raceNumber: -1 });
      const raceNumber = lastRace ? lastRace.raceNumber + 1 : 1;
      const raceId = `RACE-${Date.now()}`;
      
      // 创建比赛记录
      const race = await Race.create({
        raceId,
        raceNumber,
        status: 'betting',
        startedAt: new Date(),
      });
      
      // 预生成比赛结果和动画帧
      const { events, winner, turtleFinalPos, rabbitFinalPos, animationFrames } = 
        this.generateRaceResult();
      
      // 更新全局状态
      gameState = {
        currentRace: race,
        phase: GAME_PHASES.BETTING,
        phaseEndTime: Date.now() + PHASE_DURATIONS.BETTING,
        raceEvents: events,
        turtlePosition: 0,
        rabbitPosition: 0,
        winner,
        turtleFinalPos,
        rabbitFinalPos,
        animationFrames,
      };
      
      console.log(`[RaceGame] 🏁 第 ${raceNumber} 局开始，下注阶段 ${PHASE_DURATIONS.BETTING / 1000} 秒`);
      
      // 广播下注阶段开始
      broadcast('race:betting_start', {
        raceId,
        raceNumber,
        phaseEndTime: gameState.phaseEndTime,
        duration: PHASE_DURATIONS.BETTING,
        betOptions: BET_OPTIONS,
      });
      
      // 设置下注阶段结束定时器
      phaseTimer = setTimeout(() => this.startRacingPhase(), PHASE_DURATIONS.BETTING);
      
    } catch (error) {
      console.error('[RaceGame] 开始新比赛失败:', error);
      setTimeout(() => this.startNewRace(), 5000);
    }
  }
  
  /**
   * 生成比赛结果和动画帧
   */
  static generateRaceResult() {
    const events = [];
    const raceDuration = PHASE_DURATIONS.RACING;
    const frameInterval = 100;
    const totalFrames = raceDuration / frameInterval;
    
    // 生成 2-4 个随机事件
    const eventCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < eventCount; i++) {
      const event = RACE_EVENTS[Math.floor(Math.random() * RACE_EVENTS.length)];
      const triggeredAt = 1000 + Math.floor(Math.random() * (raceDuration - 3000));
      events.push({ ...event, triggeredAt });
    }
    events.sort((a, b) => a.triggeredAt - b.triggeredAt);
    
    // 预计算每一帧的位置
    const animationFrames = [];
    let turtlePos = 0;
    let rabbitPos = 0;
    let turtleMult = 1;
    let rabbitMult = 1;
    let eventIndex = 0;
    
    for (let frame = 0; frame <= totalFrames; frame++) {
      const currentTime = frame * frameInterval;
      
      // 检查事件触发
      while (eventIndex < events.length && events[eventIndex].triggeredAt <= currentTime) {
        const evt = events[eventIndex];
        if (evt.target === 'turtle') turtleMult = evt.multiplier;
        else if (evt.target === 'rabbit') rabbitMult = evt.multiplier;
        else { turtleMult = evt.multiplier; rabbitMult = evt.multiplier; }
        eventIndex++;
      }
      
      // 计算位置增量
      const deltaTime = frameInterval / 1000;
      turtlePos = Math.min(100, turtlePos + BASE_SPEED.turtle * deltaTime * turtleMult);
      rabbitPos = Math.min(100, rabbitPos + BASE_SPEED.rabbit * deltaTime * rabbitMult);
      
      animationFrames.push({
        time: currentTime,
        turtle: turtlePos,
        rabbit: rabbitPos,
        event: eventIndex > 0 && events[eventIndex - 1].triggeredAt === currentTime 
          ? events[eventIndex - 1] : null
      });
      
      if (turtlePos >= 100 || rabbitPos >= 100) break;
    }
    
    const winner = turtlePos >= rabbitPos ? 'turtle' : 'rabbit';
    
    return {
      events,
      winner,
      turtleFinalPos: Math.min(turtlePos, 100),
      rabbitFinalPos: Math.min(rabbitPos, 100),
      animationFrames,
    };
  }
  
  /**
   * 开始比赛阶段
   */
  static async startRacingPhase() {
    if (!gameState.currentRace) return;
    
    console.log(`[RaceGame] 🏃 第 ${gameState.currentRace.raceNumber} 局比赛开始`);
    
    gameState.phase = GAME_PHASES.RACING;
    gameState.phaseEndTime = Date.now() + PHASE_DURATIONS.RACING;
    
    await Race.findByIdAndUpdate(gameState.currentRace._id, { status: 'racing' });
    
    // 广播比赛开始（包含完整动画帧）
    broadcast('race:racing_start', {
      raceId: gameState.currentRace.raceId,
      animationFrames: gameState.animationFrames,
      events: gameState.raceEvents.map(e => ({
        id: e.id,
        name: e.name,
        target: e.target,
        triggeredAt: e.triggeredAt,
        duration: e.duration,
        icon: e.icon,
        color: e.color,
      })),
      duration: PHASE_DURATIONS.RACING,
      phaseEndTime: gameState.phaseEndTime,
    });
    
    phaseTimer = setTimeout(() => this.startSettlingPhase(), PHASE_DURATIONS.RACING);
  }
  
  /**
   * 结算阶段
   */
  static async startSettlingPhase() {
    if (!gameState.currentRace) return;
    
    console.log(`[RaceGame] 💰 第 ${gameState.currentRace.raceNumber} 局结算中...`);
    
    gameState.phase = GAME_PHASES.SETTLING;
    const winner = gameState.winner;
    
    // 更新比赛记录
    await Race.findByIdAndUpdate(gameState.currentRace._id, {
      status: 'settled',
      endedAt: new Date(),
      result: {
        winner,
        turtlePosition: gameState.turtleFinalPos,
        rabbitPosition: gameState.rabbitFinalPos,
      },
      events: gameState.raceEvents,
      animationFrames: gameState.animationFrames,
    });
    
    // 结算所有下注
    const settlementResult = await this.settleBets(gameState.currentRace.raceId, winner);
    
    // 更新比赛统计
    await Race.findByIdAndUpdate(gameState.currentRace._id, {
      settlementStats: settlementResult,
    });
    
    // 广播全局结果
    broadcast('race:settled', {
      raceId: gameState.currentRace.raceId,
      raceNumber: gameState.currentRace.raceNumber,
      winner,
      turtlePosition: gameState.turtleFinalPos,
      rabbitPosition: gameState.rabbitFinalPos,
    });
    
    console.log(`[RaceGame] ✅ 第 ${gameState.currentRace.raceNumber} 局结算完成，胜者: ${winner}`);
    
    // 5秒后开始下一局
    phaseTimer = setTimeout(() => this.startNewRace(), PHASE_DURATIONS.SETTLING);
  }
  
  /**
   * 结算所有下注
   */
  static async settleBets(raceId, winner) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const bets = await Bet.find({ raceId, status: 'pending' }).session(session);
      
      let totalWinners = 0;
      let totalPayout = 0;
      let totalBet = 0;
      
      for (const bet of bets) {
        totalBet += bet.amount;
        const isWin = bet.side === winner;
        const winAmount = isWin ? Math.floor(bet.amount * ODDS[bet.side]) : 0;
        
        bet.isWin = isWin;
        bet.winAmount = winAmount;
        bet.status = 'settled';
        await bet.save({ session });
        
        if (isWin) {
          // 给用户加积分
          const user = await User.findByIdAndUpdate(
            bet.userId,
            { $inc: { points: winAmount } },
            { session, new: true }
          );
          
          // 创建交易记录
          await Transaction.create([{
            userId: bet.userId,
            type: TRANSACTION_TYPES.REWARD,
            amount: winAmount,
            description: `龟兔赛跑第${gameState.currentRace.raceNumber}局胜利`,
            status: 'completed',
          }], { session });
          
          totalWinners++;
          totalPayout += winAmount;
          
          // 推送个人结算
          sendToUser(bet.userId.toString(), 'race:user_settled', {
            isWin: true,
            winAmount,
            newBalance: user.points,
            raceNumber: gameState.currentRace.raceNumber,
          });
        } else {
          // 推送个人结算
          sendToUser(bet.userId.toString(), 'race:user_settled', {
            isWin: false,
            loseAmount: bet.amount,
            raceNumber: gameState.currentRace.raceNumber,
          });
        }
      }
      
      await session.commitTransaction();
      session.endSession();
      
      // 计算净盈亏（正数=平台盈利，负数=平台亏损）
      const netProfit = totalBet - totalPayout;
      
      console.log(`[RaceGame] 结算: ${bets.length}注, ${totalWinners}人胜, 派彩${totalPayout}, 净盈亏${netProfit}`);
      
      return {
        totalWinners,
        totalPayout,
        totalBet,
        netProfit,
      };
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('[RaceGame] 结算失败:', error);
      throw error;
    }
  }
  
  /**
   * 用户下注
   */
  static async placeBet(userId, side, amount) {
    // 检查阶段
    if (gameState.phase !== GAME_PHASES.BETTING) {
      throw new Error('当前不在下注阶段');
    }
    
    // 检查最后5秒
    const remainingTime = gameState.phaseEndTime - Date.now();
    if (remainingTime < 5000) {
      throw new Error('下注时间已结束，请等待下一局');
    }
    
    // 检查金额
    if (!BET_OPTIONS.includes(amount)) {
      throw new Error('无效的下注金额');
    }
    
    const user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');
    if (user.points < amount) throw new Error('积分不足');
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 检查是否已下注
      const existingBet = await Bet.findOne({
        raceId: gameState.currentRace.raceId,
        userId
      }).session(session);
      
      if (existingBet) {
        await session.abortTransaction();
        session.endSession();
        throw new Error('本轮已下注，不能重复下注');
      }
      
      // 扣除积分
      user.points -= amount;
      await user.save({ session });
      
      // 创建下注记录
      const bet = await Bet.create([{
        raceId: gameState.currentRace.raceId,
        raceNumber: gameState.currentRace.raceNumber,
        userId,
        side,
        amount,
      }], { session });
      
      // 创建交易记录
      await Transaction.create([{
        userId,
        type: TRANSACTION_TYPES.BET,
        amount: -amount,
        description: `龟兔赛跑第${gameState.currentRace.raceNumber}局下注`,
        status: 'completed',
      }], { session });
      
      // 更新比赛统计
      await Race.findByIdAndUpdate(gameState.currentRace._id, {
        $inc: {
          'bettingStats.totalBets': 1,
          'bettingStats.totalAmount': amount,
          [`bettingStats.${side}Bets`]: 1,
          [`bettingStats.${side}Amount`]: amount,
        }
      }, { session });
      
      await session.commitTransaction();
      session.endSession();
      
      // 广播下注更新
      broadcast('race:bet_placed', {
        side,
        amount,
        raceNumber: gameState.currentRace.raceNumber,
      });
      
      return { 
        success: true, 
        bet: bet[0], 
        balance: user.points,
        raceNumber: gameState.currentRace.raceNumber,
      };
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
  
  /**
   * 获取当前游戏状态
   */
  static getCurrentState() {
    return {
      raceId: gameState.currentRace?.raceId,
      raceNumber: gameState.currentRace?.raceNumber,
      phase: gameState.phase,
      phaseEndTime: gameState.phaseEndTime,
      turtlePosition: gameState.turtlePosition,
      rabbitPosition: gameState.rabbitPosition,
      winner: gameState.phase === GAME_PHASES.SETTLING ? gameState.winner : null,
      betOptions: BET_OPTIONS,
    };
  }
  
  /**
   * 获取历史记录
   */
  static async getHistory(limit = 10) {
    return Race.find({ status: 'settled' })
      .sort({ raceNumber: -1 })
      .limit(limit)
      .select('raceId raceNumber result startedAt bettingStats');
  }
  
  /**
   * 获取用户下注记录
   */
  static async getUserBetHistory(userId, limit = 20) {
    return Bet.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('raceId', 'raceNumber result');
  }
}

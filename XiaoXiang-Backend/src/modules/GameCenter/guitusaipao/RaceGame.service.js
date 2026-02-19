// src/modules/GameCenter/guitusaipao/RaceGame.service.js
import mongoose from 'mongoose';
import { Race, Bet, RaceHistory } from './RaceGame.models.js';
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
  poolStats: { turtle: { amount: 0, count: 0 }, rabbit: { amount: 0, count: 0 } },
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
    
    const pendingRace = await Race.findOne({ status: { $ne: 'settled' } }).sort({ startedAt: -1 });
    if (pendingRace) {
      await Race.findByIdAndUpdate(pendingRace._id, { status: 'settled' });
    }
    
    await this.startNewRace();
  }
  
  /**
   * 开始新一轮比赛
   */
  static async startNewRace() {
    try {
      const lastRace = await Race.findOne().sort({ raceNumber: -1 });
      const raceNumber = lastRace ? lastRace.raceNumber + 1 : 1;
      const raceId = `RACE-${Date.now()}`;
      
      const race = await Race.create({
        raceId,
        raceNumber,
        status: 'betting',
        startedAt: new Date(),
      });
      
      const { events, winner, turtleFinalPos, rabbitFinalPos, animationFrames } = 
        this.generateRaceResult();
      
      const poolStats = { 
        turtle: { amount: 0, count: 0 }, 
        rabbit: { amount: 0, count: 0 } 
      };
      
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
        poolStats,
      };
      
      console.log(`[RaceGame] 🏁 第 ${raceNumber} 局开始，下注阶段 ${PHASE_DURATIONS.BETTING / 1000} 秒`);
      console.log(`[RaceGame] 🎲 预生成结果: 胜者=${winner}`);
      
      broadcast('race:betting_start', {
        raceId,
        raceNumber,
        phaseEndTime: gameState.phaseEndTime,
        duration: PHASE_DURATIONS.BETTING,
        betOptions: BET_OPTIONS,
      });
      
      phaseTimer = setTimeout(() => this.startRacingPhase(), PHASE_DURATIONS.BETTING);
      
    } catch (error) {
      console.error('[RaceGame] 开始新比赛失败:', error);
      setTimeout(() => this.startNewRace(), 5000);
    }
  }
  
  /**
   * 生成比赛结果和动画帧（纯50%概率）
   */
  static generateRaceResult() {
    const events = [];
    const raceDuration = PHASE_DURATIONS.RACING;
    const frameInterval = 50;
    const totalFrames = raceDuration / frameInterval;
    
    // ========== 核心：纯50%概率决定胜者 ==========
    const winner = Math.random() < 0.5 ? 'turtle' : 'rabbit';
    console.log(`[RaceGame] 🎲 随机胜者: ${winner} (50%概率)`);
    
    // 生成 1-2 个随机事件
    const eventCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < eventCount; i++) {
      const event = RACE_EVENTS[Math.floor(Math.random() * RACE_EVENTS.length)];
      const triggeredAt = 500 + Math.floor(Math.random() * (raceDuration - 1500));
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
      
      while (eventIndex < events.length && events[eventIndex].triggeredAt <= currentTime) {
        const evt = events[eventIndex];
        if (evt.target === 'turtle') turtleMult = evt.multiplier;
        else if (evt.target === 'rabbit') rabbitMult = evt.multiplier;
        else { turtleMult = evt.multiplier; rabbitMult = evt.multiplier; }
        eventIndex++;
      }
      
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
    
    // ========== 强制设置胜者结果 ==========
    let finalTurtle = Math.min(turtlePos, 100);
    let finalRabbit = Math.min(rabbitPos, 100);
    
    if (winner === 'turtle') {
      // 乌龟胜：乌龟100，兔子最多99
      finalTurtle = 100;
      finalRabbit = Math.min(finalRabbit, 99);
    } else {
      // 兔子胜：兔子100，乌龟最多99
      finalRabbit = 100;
      finalTurtle = Math.min(finalTurtle, 99);
    }
    
    // 添加最后一帧
    animationFrames.push({
      time: raceDuration,
      turtle: finalTurtle,
      rabbit: finalRabbit,
      event: null
    });
    
    return {
      events,
      winner,
      turtleFinalPos: finalTurtle,
      rabbitFinalPos: finalRabbit,
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
    
    broadcast('race:racing_start', {
      raceId: gameState.currentRace.raceId,
      raceNumber: gameState.currentRace.raceNumber,
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
      poolStats: gameState.poolStats,
    });
    
    await this.createRaceHistory(gameState.currentRace, winner);
    
    const settlementResult = await this.settleBets(gameState.currentRace.raceId, winner);
    
    await Race.findByIdAndUpdate(gameState.currentRace._id, {
      settlementStats: settlementResult,
    });
    
    broadcast('race:settled', {
      raceId: gameState.currentRace.raceId,
      raceNumber: gameState.currentRace.raceNumber,
      winner,
      turtlePosition: gameState.turtleFinalPos,
      rabbitPosition: gameState.rabbitFinalPos,
      poolStats: gameState.poolStats,
    });
    
    console.log(`[RaceGame] ✅ 第 ${gameState.currentRace.raceNumber} 局结算完成，胜者: ${winner}`);
    
    phaseTimer = setTimeout(() => this.startNewRace(), PHASE_DURATIONS.SETTLING);
  }
  
  /**
   * 创建历史记录流水
   */
  static async createRaceHistory(race, winner) {
    try {
      const historyRecord = await RaceHistory.create({
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        winner: winner,
        turtlePosition: gameState.turtleFinalPos,
        rabbitPosition: gameState.rabbitFinalPos,
        events: gameState.raceEvents.map(e => ({
          eventId: e.id,
          name: e.name,
          target: e.target,
          triggeredAt: e.triggeredAt,
        })),
        poolStats: gameState.poolStats,
        startedAt: race.startedAt,
        endedAt: new Date(),
      });
      
      console.log(`[RaceGame] 📜 历史记录已保存: 第${race.raceNumber}局`);
      return historyRecord;
    } catch (error) {
      console.error('[RaceGame] 创建历史记录失败:', error);
    }
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
          const user = await User.findByIdAndUpdate(
            bet.userId,
            { $inc: { points: winAmount } },
            { session, new: true }
          );
          
          await Transaction.create([{
            userId: bet.userId,
            type: TRANSACTION_TYPES.REWARD,
            amount: winAmount,
            description: `龟兔赛跑第${gameState.currentRace.raceNumber}局胜利`,
            status: 'completed',
          }], { session });
          
          totalWinners++;
          totalPayout += winAmount;
          
          sendToUser(bet.userId.toString(), 'race:user_settled', {
            isWin: true,
            winAmount,
            newBalance: user.points,
            raceNumber: gameState.currentRace.raceNumber,
          });
        } else {
          sendToUser(bet.userId.toString(), 'race:user_settled', {
            isWin: false,
            loseAmount: bet.amount,
            raceNumber: gameState.currentRace.raceNumber,
          });
        }
      }
      
      await session.commitTransaction();
      session.endSession();
      
      const netProfit = totalBet - totalPayout;
      
      console.log(`[RaceGame] 结算: ${bets.length}注, ${totalWinners}人胜, 派彩${totalPayout}, 净盈亏${netProfit}`);
      
      return { totalWinners, totalPayout, totalBet, netProfit };
      
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
    if (gameState.phase !== GAME_PHASES.BETTING) {
      throw new Error('当前不在下注阶段');
    }
    
    const remainingTime = gameState.phaseEndTime - Date.now();
    if (remainingTime < 5000) {
      throw new Error('下注时间已结束，请等待下一局');
    }
    
    if (!BET_OPTIONS.includes(amount)) {
      throw new Error('无效的下注金额');
    }
    
    const user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');
    if (user.points < amount) throw new Error('积分不足');
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const existingBet = await Bet.findOne({
        raceId: gameState.currentRace.raceId,
        userId
      }).session(session);
      
      if (existingBet) {
        await session.abortTransaction();
        session.endSession();
        throw new Error('本轮已下注，不能重复下注');
      }
      
      user.points -= amount;
      await user.save({ session });
      
      const bet = await Bet.create([{
        raceId: gameState.currentRace.raceId,
        raceNumber: gameState.currentRace.raceNumber,
        userId,
        side,
        amount,
      }], { session });
      
      await Transaction.create([{
        userId,
        type: TRANSACTION_TYPES.BET,
        amount: -amount,
        description: `龟兔赛跑第${gameState.currentRace.raceNumber}局下注`,
        status: 'completed',
      }], { session });
      
      gameState.poolStats[side].amount += amount;
      gameState.poolStats[side].count += 1;
      
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
      
      broadcast('race:bet_placed', {
        side,
        amount,
        raceNumber: gameState.currentRace.raceNumber,
        poolStats: gameState.poolStats,
      });
      
      return { 
        success: true, 
        bet: bet[0], 
        balance: user.points,
        raceNumber: gameState.currentRace.raceNumber,
        poolStats: gameState.poolStats,
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
      poolStats: gameState.poolStats,
    };
  }
  
  /**
   * 获取历史记录
   */
  static async getHistory(limit = 10) {
    try {
      const historyFromTable = await RaceHistory.find()
        .sort({ raceNumber: -1 })
        .limit(limit)
        .select('raceId raceNumber winner turtlePosition rabbitPosition startedAt endedAt poolStats');
      
      if (historyFromTable.length > 0) {
        return historyFromTable;
      }
      
      return Race.find({ status: 'settled' })
        .sort({ raceNumber: -1 })
        .limit(limit)
        .select('raceId raceNumber result startedAt poolStats');
    } catch (error) {
      console.error('[RaceGame] 获取历史记录失败:', error);
      return [];
    }
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
  
  /**
   * 获取投注池统计
   */
  static getPoolStats() {
    return gameState.poolStats;
  }
}

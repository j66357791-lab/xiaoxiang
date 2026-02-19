// src/modules/GameCenter/flipcard/FlipCard.service.js
// 优化版本：startGame 返回乌龟位置，支持异步数据库录入
import FlipCardGame from './FlipCard.models.js';
import User from '../../users/user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError } from '../../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';
import { LEVELS, FEE_RATE } from './FlipCard.config.js';
import crypto from 'crypto';
import mongoose from 'mongoose';

// 加密密钥（生产环境应使用环境变量）
const ENCRYPTION_KEY = process.env.FLIPCARD_KEY || 'xiaoxiang-flipcard-secret-key-32b';

export class FlipCardService {
  
  /**
   * 简单加密
   */
  static encryptCards(cards) {
    const data = JSON.stringify(cards);
    const encoded = Buffer.from(data).toString('base64');
    return encoded;
  }

  /**
   * 简单解密
   */
  static decryptCards(encrypted) {
    const data = Buffer.from(encrypted, 'base64').toString('utf-8');
    return JSON.parse(data);
  }

  /**
   * 开始游戏 - 购买门票
   * 🆕 优化：直接返回乌龟位置，前端本地判断
   */
  static async startGame(userId, levelId = 'easy', ticketPrice = 10) {
    const levelConfig = LEVELS[levelId];
    if (!levelConfig) {
      throw new BadRequestError('无效的场次');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    if (user.points < ticketPrice) {
      throw new BadRequestError('积分不足');
    }

    // 🆕 先生成卡片布局（在事务外，减少事务时间）
    const cards = this.generateCards(levelConfig.rabbit, levelConfig.turtle);
    
    // 🆕 提取乌龟位置
    const turtlePositions = cards
      .map((card, index) => card.type === 'turtle' ? index : -1)
      .filter(index => index !== -1);
    
    // 🆕 提取完整布局（前端可选使用）
    const fullLayout = cards.map(card => card.type);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 扣除门票费用
      user.points -= ticketPrice;
      await user.save();

      await Transaction.create([{
        userId: user._id,
        type: 'flipcard_ticket',
        amount: ticketPrice,
        balanceSnapshot: user.points,
        description: `翻牌游戏-${levelConfig.name}门票`,
        status: 'completed',
      }], { session, ordered: true });

      // 加密卡片布局
      const encryptedCards = this.encryptCards(cards);

      const game = await FlipCardGame.create([{
        userId,
        levelId,
        levelName: levelConfig.name,
        ticketPrice,
        factor: levelConfig.factor,
        totalCards: levelConfig.totalCards,
        rabbitCount: levelConfig.rabbit,
        turtleCount: levelConfig.turtle,
        cards,
        encryptedCards, // 存储加密后的布局
        currentScore: ticketPrice,
        flippedCards: [],
        flippedRabbits: 0,
        status: 'playing',
      }], { session });

      await session.commitTransaction();
      clearCache('/api/users/profile');

      console.log(`[FlipCard] 用户 ${user.email} 开始游戏，场次: ${levelConfig.name}，门票: ${ticketPrice}`);
      console.log(`[FlipCard] 卡片布局:`, cards.map(c => c.type === 'turtle' ? '🐢' : '🐇').join(' '));
      console.log(`[FlipCard] 乌龟位置:`, turtlePositions);

      return {
        gameId: game[0]._id,
        balance: user.points,
        ticketPrice,
        currentScore: ticketPrice,
        totalCards: levelConfig.totalCards,
        rabbitCount: levelConfig.rabbit,
        turtleCount: levelConfig.turtle,
        factor: levelConfig.factor,
        levelName: levelConfig.name,
        
        // 🆕 返回乌龟位置（前端本地判断用）
        turtlePositions,
        // 🆕 返回完整布局（前端可选使用）
        fullLayout,
        // 保留加密布局（用于验证）
        encryptedLayout: encryptedCards,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 生成卡片布局（洗牌）
   */
  static generateCards(rabbitCount, turtleCount) {
    const cards = [];
    
    for (let i = 0; i < rabbitCount; i++) {
      cards.push({ type: 'rabbit', flipped: false });
    }
    
    for (let i = 0; i < turtleCount; i++) {
      cards.push({ type: 'turtle', flipped: false });
    }
    
    // Fisher-Yates 洗牌
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    
    return cards;
  }

  /**
   * 翻牌 - 直接从预埋的布局中读取
   * 🆕 保留此接口用于验证或兼容旧版本
   */
  static async flipCard(userId, gameId, cardIndex) {
    const game = await FlipCardGame.findById(gameId);
    
    if (!game) {
      throw new NotFoundError('游戏不存在');
    }
    
    if (game.userId.toString() !== userId.toString()) {
      throw new BadRequestError('这不是你的游戏');
    }
    
    if (game.status !== 'playing') {
      throw new BadRequestError('游戏已结束');
    }
    
    if (cardIndex < 0 || cardIndex >= game.cards.length) {
      throw new BadRequestError('无效的卡片索引');
    }
    
    if (game.cards[cardIndex].flipped) {
      throw new BadRequestError('该卡片已翻开');
    }

    // 直接从预埋的布局中读取卡片类型
    const cardType = game.cards[cardIndex].type;
    
    // 翻开卡片
    game.cards[cardIndex].flipped = true;
    game.flippedCards.push(cardIndex);
    
    if (cardType === 'turtle') {
      // 翻到乌龟，游戏结束
      game.status = 'lost';
      game.currentScore = 0;
      game.finalReward = 0;
      game.fee = 0;
      await game.save();
      
      console.log(`[FlipCard] 用户翻到乌龟(索引${cardIndex})，游戏结束`);
      
      return {
        cardType: 'turtle',
        result: 'lose',
        currentScore: 0,
        flippedRabbits: game.flippedRabbits,
        fullLayout: game.cards.map(c => c.type),
        message: '翻到乌龟，游戏结束！'
      };
      
    } else {
      // 翻到兔子
      game.flippedRabbits += 1;
      const newScore = Math.floor(game.currentScore * game.factor * 100) / 100;
      game.currentScore = newScore;
      
      // 检查是否翻完所有兔子
      if (game.flippedRabbits >= game.rabbitCount) {
        const reward = game.currentScore;
        const fee = Math.floor(reward * FEE_RATE * 100) / 100;
        const actualReward = Math.floor((reward - fee) * 100) / 100;
        
        game.status = 'won';
        game.finalReward = actualReward;
        game.fee = fee;
        await game.save();
        
        const user = await User.findById(userId);
        user.points += actualReward;
        await user.save();
        
        await Transaction.create([{
          userId: user._id,
          type: 'flipcard_reward',
          amount: actualReward,
          balanceSnapshot: user.points,
          description: `翻牌游戏胜利，获得${actualReward}积分（手续费${fee}）`,
          status: 'completed',
        }]);
        
        clearCache('/api/users/profile');
        
        console.log(`[FlipCard] 用户翻完所有兔子，胜利！获得 ${actualReward} 积分`);
        
        return {
          cardType: 'rabbit',
          result: 'win',
          currentScore: reward,
          flippedRabbits: game.flippedRabbits,
          reward: actualReward,
          fee: fee,
          fullLayout: game.cards.map(c => c.type),
          message: '恭喜！翻完所有兔子！'
        };
      }
      
      await game.save();
      
      const nextScore = Math.floor(newScore * game.factor * 100) / 100;
      
      return {
        cardType: 'rabbit',
        result: 'continue',
        currentScore: newScore,
        nextScore: nextScore,
        flippedRabbits: game.flippedRabbits,
        message: '翻到兔子，继续加油！'
      };
    }
  }

  /**
   * 🆕 游戏结果上报（前端本地判断后上报）
   * 用于异步更新数据库，不阻塞用户体验
   */
  static async reportResult(userId, gameId, result, turtleIndex, finalScore, flippedCards) {
    const game = await FlipCardGame.findById(gameId);
    
    if (!game) {
      throw new NotFoundError('游戏不存在');
    }
    
    if (game.userId.toString() !== userId.toString()) {
      throw new BadRequestError('这不是你的游戏');
    }
    
    if (game.status !== 'playing') {
      // 游戏已结束，忽略重复上报
      return { success: true, message: '游戏已结束' };
    }

    // 更新翻开的卡片
    if (flippedCards && Array.isArray(flippedCards)) {
      flippedCards.forEach((flipped, index) => {
        if (flipped && game.cards[index]) {
          game.cards[index].flipped = true;
          if (!game.flippedCards.includes(index)) {
            game.flippedCards.push(index);
          }
        }
      });
    }

    if (result === 'lose') {
      // 输了
      game.status = 'lost';
      game.currentScore = 0;
      game.finalReward = 0;
      game.fee = 0;
      game.flippedRabbits = game.flippedCards.filter(i => game.cards[i]?.type === 'rabbit').length;
      
      await game.save();
      
      console.log(`[FlipCard] 用户上报失败结果，乌龟位置: ${turtleIndex}`);
      
      return {
        success: true,
        status: 'lost',
        fullLayout: game.cards.map(c => c.type)
      };
      
    } else if (result === 'win') {
      // 赢了 - 需要发放奖励
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        const totalScore = finalScore || game.ticketPrice;
        const fee = Math.floor(totalScore * FEE_RATE * 100) / 100;
        const actualReward = Math.floor((totalScore - fee) * 100) / 100;
        
        game.status = 'won';
        game.finalReward = actualReward;
        game.fee = fee;
        game.currentScore = totalScore;
        game.flippedRabbits = game.rabbitCount;
        
        await game.save();
        
        const user = await User.findById(userId).session(session);
        user.points += actualReward;
        await user.save();
        
        await Transaction.create([{
          userId: user._id,
          type: 'flipcard_reward',
          amount: actualReward,
          balanceSnapshot: user.points,
          description: `翻牌游戏胜利，获得${actualReward}积分（手续费${fee}）`,
          status: 'completed',
        }], { session, ordered: true });
        
        await session.commitTransaction();
        clearCache('/api/users/profile');
        
        console.log(`[FlipCard] 用户上报胜利结果，获得 ${actualReward} 积分`);
        
        return {
          success: true,
          status: 'won',
          reward: actualReward,
          fee: fee,
          newBalance: user.points,
          fullLayout: game.cards.map(c => c.type)
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }
    
    return { success: true };
  }

  /**
   * 手动结算
   */
  static async settleGame(userId, gameId) {
    const game = await FlipCardGame.findById(gameId);
    
    if (!game) {
      throw new NotFoundError('游戏不存在');
    }
    
    if (game.userId.toString() !== userId.toString()) {
      throw new BadRequestError('这不是你的游戏');
    }
    
    if (game.status !== 'playing') {
      throw new BadRequestError('游戏已结束');
    }
    
    if (game.flippedRabbits === 0) {
      throw new BadRequestError('请先翻牌再结算');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const totalScore = game.currentScore;
      const fee = Math.floor(totalScore * FEE_RATE * 100) / 100;
      const actualReward = Math.floor((totalScore - fee) * 100) / 100;
      
      game.status = 'settled';
      game.finalReward = actualReward;
      game.fee = fee;
      await game.save();

      const user = await User.findById(userId).session(session);
      user.points += actualReward;
      await user.save();

      await Transaction.create([{
        userId: user._id,
        type: 'flipcard_reward',
        amount: actualReward,
        balanceSnapshot: user.points,
        description: `翻牌游戏结算，获得${actualReward}积分（手续费${fee}）`,
        status: 'completed',
      }], { session, ordered: true });

      await session.commitTransaction();
      clearCache('/api/users/profile');

      console.log(`[FlipCard] 用户手动结算，获得 ${actualReward} 积分`);

      return {
        totalScore,
        fee,
        actualReward,
        newBalance: user.points,
        fullLayout: game.cards.map(c => c.type)
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 获取游戏详情
   */
  static async getGameDetail(userId, gameId) {
    const game = await FlipCardGame.findById(gameId);
    
    if (!game) {
      throw new NotFoundError('游戏不存在');
    }
    
    if (game.userId.toString() !== userId.toString()) {
      throw new BadRequestError('这不是你的游戏');
    }
    
    return {
      gameId: game._id,
      levelId: game.levelId,
      levelName: game.levelName,
      ticketPrice: game.ticketPrice,
      factor: game.factor,
      totalCards: game.totalCards,
      rabbitCount: game.rabbitCount,
      turtleCount: game.turtleCount,
      currentScore: game.currentScore,
      flippedRabbits: game.flippedRabbits,
      status: game.status,
      finalReward: game.finalReward,
      fee: game.fee,
      cards: game.cards.map((card, index) => ({
        index,
        type: card.flipped ? card.type : null,
        flipped: card.flipped
      })),
      // 游戏结束后显示完整布局
      fullLayout: game.status !== 'playing' ? game.cards.map(c => c.type) : null,
      createdAt: game.createdAt,
    };
  }
}

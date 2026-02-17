// src/modules/gamescaiquan/gamescaiquan.service.js
import Game from './gamescaiquan.model.js';
import User from '../users/user.model.js';
import Transaction from '../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/error.js';
import { clearCache } from '../../common/middlewares/cache.js';
import mongoose from 'mongoose';

export class GameScaiquanService {
  /**
   * 获取等待中的对局列表
   */
  static async getWaitingGames(userId) {
    const games = await Game.find({
      status: 'waiting',
      creatorId: { $ne: userId }, // 排除自己创建的
    })
      .populate('creatorId', 'email name')
      .sort({ createdAt: -1 })
      .limit(50);

    return games.map(game => ({
      _id: game._id,
      stake: game.stake,
      creatorNickname: game.creatorId?.name || game.creatorId?.email?.split('@')[0] || '神秘玩家',
      creatorHand: game.creatorHand,
      createdAt: game.createdAt,
    }));
  }

  /**
   * 创建对局（使用积分）
   */
  static async createGame(userId, stake, hand) {
    // 验证参数
    if (!stake || stake <= 0) {
      throw new BadRequestError('赌注必须大于0');
    }
    if (!['rock', 'paper', 'scissors'].includes(hand)) {
      throw new BadRequestError('无效的手势');
    }

    // 检查用户积分
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    if (user.points < stake) {
      throw new BadRequestError('积分不足');
    }

    // 检查是否有未完成的对局
    const existingGame = await Game.findOne({
      creatorId: userId,
      status: 'waiting',
    });
    if (existingGame) {
      throw new ConflictError('您已有一个等待中的对局，请等待他人加入或取消');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 扣除积分
      user.points -= stake;
      await user.save();

      // 创建交易记录
      await Transaction.create([{
        userId: user._id,
        type: 'points_expense',
        amount: stake,
        balanceSnapshot: user.points,
        description: `创建猜拳对局，赌注${stake}积分`,
        status: 'completed',
      }], { session, ordered: true });

      // 创建对局
      const game = await Game.create([{
        creatorId: userId,
        creatorNickname: user.name || user.email?.split('@')[0] || '神秘玩家',
        creatorHand: hand,
        stake,
        status: 'waiting',
      }], { session });

      await session.commitTransaction();
      clearCache('/api/users/profile');

      console.log(`[GameScaiquan] 用户 ${user.email} 创建猜拳对局，赌注 ${stake} 积分`);

      return {
        gameId: game[0]._id,
        newPoints: user.points,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 加入对局（使用积分）
   */
  static async joinGame(userId, gameId, hand) {
    // 验证参数
    if (!['rock', 'paper', 'scissors'].includes(hand)) {
      throw new BadRequestError('无效的手势');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 查找对局
      const game = await Game.findById(gameId).session(session);
      if (!game) {
        throw new NotFoundError('对局不存在');
      }
      if (game.status !== 'waiting') {
        throw new BadRequestError('该对局已结束');
      }
      if (game.creatorId.toString() === userId.toString()) {
        throw new BadRequestError('不能加入自己创建的对局');
      }

      // 检查用户积分
      const joiner = await User.findById(userId).session(session);
      if (!joiner) {
        throw new NotFoundError('用户不存在');
      }
      if (joiner.points < game.stake) {
        throw new BadRequestError('积分不足');
      }

      const creator = await User.findById(game.creatorId).session(session);
      if (!creator) {
        throw new NotFoundError('创建者不存在');
      }

      // 扣除加入者积分
      joiner.points -= game.stake;
      await joiner.save();

      // 创建加入者交易记录
      await Transaction.create([{
        userId: joiner._id,
        type: 'points_expense',
        amount: game.stake,
        balanceSnapshot: joiner.points,
        description: `加入猜拳对局，赌注${game.stake}积分`,
        status: 'completed',
      }], { session, ordered: true });

      // 设置加入者手势
      game.joinerId = userId;
      game.joinerNickname = joiner.name || joiner.email?.split('@')[0] || '神秘玩家';
      game.joinerHand = hand;

      // 判定胜负
      const result = this.determineWinner(game.creatorHand, hand);
      const winAmount = game.stake * 2; // 赢家获得双倍赌注

      let winner, loser;
      if (result === 'creator') {
        game.winnerId = game.creatorId;
        game.winAmount = winAmount;
        winner = creator;
        loser = joiner;
      } else if (result === 'joiner') {
        game.winnerId = userId;
        game.winAmount = winAmount;
        winner = joiner;
        loser = creator;
      } else {
        // 平局：返还积分
        game.status = 'completed';
        game.completedAt = new Date();
        await game.save();

        // 返还双方积分
        creator.points += game.stake;
        joiner.points += game.stake;
        await creator.save();
        await joiner.save();

        await session.commitTransaction();

        return {
          won: false,
          tie: true,
          opponentHand: game.creatorHand,
          stake: game.stake,
          newPoints: joiner.points,
          message: '平局！积分已返还',
        };
      }

      // 给赢家加积分
      winner.points += winAmount;
      await winner.save();

      // 创建赢家交易记录
      await Transaction.create([{
        userId: winner._id,
        type: 'points_income',
        amount: winAmount,
        balanceSnapshot: winner.points,
        description: `猜拳胜利，赢得${winAmount}积分`,
        status: 'completed',
      }], { session, ordered: true });

      // 更新对局状态
      game.status = 'completed';
      game.completedAt = new Date();
      await game.save();

      await session.commitTransaction();
      clearCache('/api/users/profile');

      console.log(`[GameScaiquan] 猜拳对局 ${gameId} 结束，赢家: ${winner.email}`);

      return {
        won: winner._id.toString() === userId.toString(),
        opponentHand: result === 'creator' ? game.creatorHand : hand,
        myHand: result === 'creator' ? hand : game.creatorHand,
        winAmount: result === 'joiner' ? winAmount : 0,
        stake: game.stake,
        newPoints: joiner.points,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 判定胜负
   */
  static determineWinner(creatorHand, joinerHand) {
    if (creatorHand === joinerHand) return 'tie';
    
    const winMap = {
      rock: 'scissors',     // 石头赢剪刀
      scissors: 'paper',    // 剪刀赢布
      paper: 'rock',        // 布赢石头
    };

    if (winMap[creatorHand] === joinerHand) {
      return 'creator';
    }
    return 'joiner';
  }

  /**
   * 取消对局
   */
  static async cancelGame(userId, gameId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const game = await Game.findById(gameId).session(session);
      if (!game) {
        throw new NotFoundError('对局不存在');
      }
      if (game.creatorId.toString() !== userId.toString()) {
        throw new BadRequestError('只能取消自己创建的对局');
      }
      if (game.status !== 'waiting') {
        throw new BadRequestError('该对局已结束，无法取消');
      }

      // 返还积分
      const user = await User.findById(userId).session(session);
      user.points += game.stake;
      await user.save();

      // 创建返还交易记录
      await Transaction.create([{
        userId: user._id,
        type: 'points_income',
        amount: game.stake,
        balanceSnapshot: user.points,
        description: `取消猜拳对局，返还${game.stake}积分`,
        status: 'completed',
      }], { session, ordered: true });

      // 更新对局状态
      game.status = 'cancelled';
      await game.save();

      await session.commitTransaction();
      clearCache('/api/users/profile');

      return { newPoints: user.points };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * 获取我的对局记录
   */
  static async getMyGames(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const games = await Game.find({
      $or: [{ creatorId: userId }, { joinerId: userId }],
      status: { $ne: 'waiting' },
    })
      .populate('creatorId', 'email name')
      .populate('joinerId', 'email name')
      .populate('winnerId', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Game.countDocuments({
      $or: [{ creatorId: userId }, { joinerId: userId }],
      status: { $ne: 'waiting' },
    });

    return {
      games: games.map(game => ({
        _id: game._id,
        stake: game.stake,
        status: game.status,
        isCreator: game.creatorId?._id?.toString() === userId.toString(),
        creatorHand: game.creatorHand,
        joinerHand: game.joinerHand,
        winnerId: game.winnerId,
        won: game.winnerId?._id?.toString() === userId.toString(),
        winAmount: game.winAmount,
        completedAt: game.completedAt,
        createdAt: game.createdAt,
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  /**
   * 获取我创建的等待中对局
   */
  static async getMyWaitingGame(userId) {
    const game = await Game.findOne({
      creatorId: userId,
      status: 'waiting',
    }).populate('creatorId', 'email name');

    if (!game) return null;

    return {
      _id: game._id,
      stake: game.stake,
      creatorHand: game.creatorHand,
      createdAt: game.createdAt,
    };
  }
}

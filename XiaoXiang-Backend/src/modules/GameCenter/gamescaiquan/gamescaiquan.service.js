// src/modules/gamescaiquan/gamescaiquan.service.js
import Game from './gamescaiquan.model.js';
import User from '../../users/user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';
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
      creatorHand: null, // 不显示对手手势
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

      // 创建交易记录（扣除积分）
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
   * 加入对局（后端核验，显示对手手势）
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

      // 计算手续费（2%）
      const fee = Math.round(game.stake * 0.02);
      const actualStake = game.stake - fee;

      // 扣除加入者积分（包括手续费）
      joiner.points -= game.stake;
      await joiner.save();

      // 创建加入者交易记录（扣除积分+手续费）
      await Transaction.create([{
        userId: joiner._id,
        type: 'points_expense',
        amount: game.stake,
        balanceSnapshot: joiner.points,
        description: `加入猜拳对局，赌注${actualStake}积分+手续费${fee}积分`,
        status: 'completed',
      }], { session, ordered: true });

      // 设置加入者手势
      game.joinerId = userId;
      game.joinerNickname = joiner.name || joiner.email?.split('@')[0] || '神秘玩家';
      game.joinerHand = hand;

      // 判定胜负
      const result = this.determineWinner(game.creatorHand, hand);
      const winAmount = actualStake * 2; // 赢家获得双倍赌注（不含手续费）

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
        // 平局：返还积分（不含手续费）
        game.status = 'completed';
        game.completedAt = new Date();
        await game.save();

        // 返还双方积分（不含手续费）
        creator.points += actualStake;
        joiner.points += actualStake;
        await creator.save();
        await joiner.save();

        await session.commitTransaction();

        return {
          won: false,
          tie: true,
          opponentHand: game.creatorHand,
          stake: actualStake,
          fee: fee,
          newPoints: joiner.points,
          message: '平局！积分已返还（扣除手续费）',
        };
      }

      // 给赢家加积分（不含手续费）
      winner.points += winAmount;
      await winner.save();

      // 创建赢家交易记录（获得积分）
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
        stake: actualStake,
        fee: fee,
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

      // 返还积分（扣除手续费）
      const fee = Math.round(game.stake * 0.02);
      const actualStake = game.stake - fee;

      const user = await User.findById(userId).session(session);
      user.points += actualStake;
      await user.save();

      // 创建返还交易记录（扣除手续费）
      await Transaction.create([{
        userId: user._id,
        type: 'points_income',
        amount: actualStake,
        balanceSnapshot: user.points,
        description: `取消猜拳对局，返还${actualStake}积分（扣除手续费${fee}积分）`,
        status: 'completed',
      }], { session, ordered: true });

      // 更新对局状态
      game.status = 'cancelled';
      await game.save();

      await session.commitTransaction();
      clearCache('/api/users/profile');

      return { newPoints: user.points, fee: fee };
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
        fee: game.stake ? Math.round(game.stake * 0.02) : 0,
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

  /**
   * 获取手续费统计
   */
  static async getFeeStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayGames = await Game.find({
      status: 'completed',
      completedAt: { $gte: today }
    });

    const totalFee = todayGames.reduce((sum, game) => sum + Math.round(game.stake * 0.02), 0);
    const totalGames = todayGames.length;
    const totalStake = todayGames.reduce((sum, game) => sum + game.stake, 0);

    // 获取历史数据
    const allGames = await Game.find({ status: 'completed' });
    const allTimeTotalFee = allGames.reduce((sum, game) => sum + Math.round(game.stake * 0.02), 0);
    const allTimeTotalGames = allGames.length;
    const allTimeTotalStake = allGames.reduce((sum, game) => sum + game.stake, 0);

    return {
      today: {
        totalGames,
        totalStake,
        totalFee,
        averageFee: totalGames > 0 ? (totalFee / totalGames).toFixed(2) : 0,
      },
      allTime: {
        totalGames: allTimeTotalGames,
        totalStake: allTimeTotalStake,
        totalFee: allTimeTotalFee,
      }
    };
  }
}

/**
 * 用户服务 - 积分/小象币模块
 * 包含：积分增减、小象币增减、兑换等方法
 */
import User from '../user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';
import { clearCache } from '../../common/middlewares/cache.js';
import mongoose from 'mongoose';

export class UserServicePoints {
  /**
   * 增加小象积分 (原子操作)
   */
  static async addPoints(userId, amount, description = '积分变动') {
    if (amount <= 0) throw new BadRequestError('积分必须大于0');

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { points: amount } },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    await Transaction.create({
      userId: user._id,
      type: 'points_income',
      amount,
      balanceSnapshot: user.points,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 积分增加成功: 用户 ${user.email}, +${amount}积分`);
    return user;
  }

  /**
   * 扣除小象积分 (高并发安全)
   */
  static async subtractPoints(userId, amount, description = '积分扣除') {
    if (amount <= 0) throw new BadRequestError('积分必须大于0');

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        points: { $gte: amount }
      },
      {
        $inc: { points: -amount }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      console.warn(`[Security Warning] 用户 ${userId} 尝试扣除 ${amount} 积分失败：积分不足`);
      throw new BadRequestError('积分不足，无法执行此操作');
    }

    await Transaction.create({
      userId: user._id,
      type: 'points_expense',
      amount,
      balanceSnapshot: user.points,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 积分扣除成功: 用户 ${user.email}, -${amount}积分`);
    return user;
  }

  /**
   * 增加小象币 (原子操作)
   */
  static async addCoins(userId, amount, description = '小象币变动') {
    if (amount <= 0) throw new BadRequestError('小象币必须大于0');

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: amount } },
      { new: true, runValidators: true }
    );

    if (!user) throw new NotFoundError('用户不存在');

    await Transaction.create({
      userId: user._id,
      type: 'coins_income',
      amount,
      balanceSnapshot: user.coins,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 小象币增加成功: 用户 ${user.email}, +${amount}币`);
    return user;
  }

  /**
   * 扣除小象币 (高并发安全)
   */
  static async subtractCoins(userId, amount, description = '小象币扣除') {
    if (amount <= 0) throw new BadRequestError('小象币必须大于0');

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        coins: { $gte: amount }
      },
      {
        $inc: { coins: -amount }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      console.warn(`[Security Warning] 用户 ${userId} 尝试扣除 ${amount} 小象币失败：小象币不足`);
      throw new BadRequestError('小象币不足，无法执行此操作');
    }

    await Transaction.create({
      userId: user._id,
      type: 'coins_expense',
      amount,
      balanceSnapshot: user.coins,
      description,
      status: 'completed'
    });

    clearCache('/api/users/profile');
    console.log(`[UserService] 小象币扣除成功: 用户 ${user.email}, -${amount}币`);
    return user;
  }

  /**
   * 小象币兑换积分
   */
  static async exchangeCoinsForPoints(userId, coins, pointsRate = 10) {
    if (coins <= 0) throw new BadRequestError('兑换小象币必须大于0');
    if (pointsRate <= 0) throw new BadRequestError('兑换比例无效');

    const pointsToReceive = coins * pointsRate;

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        coins: { $gte: coins }
      },
      {
        $inc: { coins: -coins, points: pointsToReceive }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      throw new BadRequestError('小象币不足');
    }

    await Transaction.create([{
      userId: user._id,
      type: 'coins_exchange',
      amount: coins,
      balanceSnapshot: user.coins,
      description: `小象币兑换积分：${coins}币 → ${pointsToReceive}积分`,
      status: 'completed'
    }, {
      userId: user._id,
      type: 'points_exchange',
      amount: pointsToReceive,
      balanceSnapshot: user.points,
      description: `小象币兑换获得：${pointsToReceive}积分`,
      status: 'completed'
    }]);

    clearCache('/api/users/profile');
    console.log(`[UserService] 小象币兑换成功: 用户 ${user.email}, ${coins}币 → ${pointsToReceive}积分`);
    return { user, coinsSpent: coins, pointsReceived: pointsToReceive };
  }

  /**
   * 积分兑换小象币
   */
  static async exchangePointsForCoins(userId, points, coinsRate = 100) {
    if (points <= 0) throw new BadRequestError('兑换积分必须大于0');
    if (coinsRate <= 0) throw new BadRequestError('兑换比例无效');

    const coinsToReceive = Math.floor(points / coinsRate);
    if (coinsToReceive <= 0) {
      throw new BadRequestError('积分不足，无法兑换');
    }

    const pointsToDeduct = coinsToReceive * coinsRate;

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        points: { $gte: pointsToDeduct }
      },
      {
        $inc: { points: -pointsToDeduct, coins: coinsToReceive }
      },
      { new: true }
    );

    if (!user) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      throw new BadRequestError('积分不足');
    }

    await Transaction.create([{
      userId: user._id,
      type: 'points_exchange',
      amount: pointsToDeduct,
      balanceSnapshot: user.points,
      description: `积分兑换小象币：${pointsToDeduct}积分 → ${coinsToReceive}币`,
      status: 'completed'
    }, {
      userId: user._id,
      type: 'coins_exchange',
      amount: coinsToReceive,
      balanceSnapshot: user.coins,
      description: `积分兑换获得：${coinsToReceive}币`,
      status: 'completed'
    }]);

    clearCache('/api/users/profile');
    console.log(`[UserService] 积分兑换成功: 用户 ${user.email}, ${pointsToDeduct}积分 → ${coinsToReceive}币`);
    return { user, pointsSpent: pointsToDeduct, coinsReceived: coinsToReceive };
  }

  /**
   * 小象币转增
   */
  static async transferCoins(senderId, receiverId, amount, password) {
    const sender = await User.findById(senderId);
    if (!sender) throw new BadRequestError('发送方用户不存在');
    
    // 验证密码
    const isValidPassword = sender.comparePassword(password);
    if (!isValidPassword) throw new BadRequestError('密码错误');
    
    // 验证接收方
    const receiver = await User.findById(receiverId);
    if (!receiver) throw new BadRequestError('接收方用户不存在');
    
    // 计算手续费（5%）
    const feeRate = 0.05;
    const fee = Math.ceil(amount * feeRate);
    const totalDeduct = amount + fee;
    
    // 验证余额
    if (sender.coins < totalDeduct) {
      throw new BadRequestError(`小象币不足，需要 ${totalDeduct} 个（含手续费 ${fee} 个）`);
    }
    
    // 执行转账（使用事务）
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 扣除发送方小象币
      sender.coins -= totalDeduct;
      await sender.save({ session });
      
      // 增加接收方小象币
      receiver.coins += amount;
      await receiver.save({ session });
      
      // 记录交易
      await Transaction.create([{
        userId: senderId,
        type: 'coins_transfer_out',
        amount: amount,
        coinsSnapshot: sender.coins,
        description: `转增给 ${receiver.name || receiver.email}`,
        metadata: { receiverId, fee },
        status: 'completed'
      }], { session });
      
      await Transaction.create([{
        userId: senderId,
        type: 'coins_transfer_fee',
        amount: fee,
        coinsSnapshot: sender.coins,
        description: `转增手续费`,
        metadata: { receiverId, transferAmount: amount },
        status: 'completed'
      }], { session });
      
      await Transaction.create([{
        userId: receiverId,
        type: 'coins_transfer_in',
        amount: amount,
        coinsSnapshot: receiver.coins,
        description: `收到 ${sender.name || sender.email} 的转增`,
        metadata: { senderId: senderId.toString() },
        status: 'completed'
      }], { session });
      
      await session.commitTransaction();
      
      console.log(`[Transfer] 💰 转增成功: ${senderId} -> ${receiverId}, 金额: ${amount}, 手续费: ${fee}`);
      
      return {
        success: true,
        transferAmount: amount,
        fee: fee,
        totalDeducted: totalDeduct,
        receiverName: receiver.name || '小象用户',
        senderBalance: sender.coins
      };
      
    } catch (err) {
      await session.abortTransaction();
      console.error('[Transfer] ❌ 转增失败:', err);
      throw new BadRequestError('转增失败，请重试');
    } finally {
      session.endSession();
    }
  }

  /**
   * 获取转增流水记录
   */
  static async getTransferHistory(userId, type = 'all', page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      type: { $in: ['coins_transfer_out', 'coins_transfer_in', 'coins_transfer_fee'] }
    };
    
    if (type === 'out') {
      filter.type = { $in: ['coins_transfer_out', 'coins_transfer_fee'] };
    } else if (type === 'in') {
      filter.type = 'coins_transfer_in';
    }
    
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(filter)
    ]);
    
    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), type: { $in: ['coins_transfer_out', 'coins_transfer_in', 'coins_transfer_fee'] } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const summary = {
      totalSent: 0,
      totalReceived: 0,
      totalFee: 0
    };
    
    stats.forEach(s => {
      if (s._id === 'coins_transfer_out') summary.totalSent = s.total;
      if (s._id === 'coins_transfer_in') summary.totalReceived = s.total;
      if (s._id === 'coins_transfer_fee') summary.totalFee = s.total;
    });
    
    return {
      transactions,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }
}

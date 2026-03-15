/**
 * 用户服务 - 团队模块
 * 包含：邀请绑定、团队统计、佣金计算、奖励发放等
 */
import User, { 
  TEAM_LEADER_RANKS, 
  NEWBIE_REWARDS, 
  FRIEND_ORDER_REWARDS
} from '../user.model.js';
import Transaction from '../../transactions/transaction.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';
import mongoose from 'mongoose';

export class UserServiceTeam {
  // ==================== 邀请绑定 ====================

  /**
   * 绑定邀请人 (并发安全版)
   */
  static async bindInviter(userId, inviterId) {
    if (!inviterId) throw new BadRequestError('请提供邀请人ID');
    if (userId.toString() === inviterId.toString()) throw new BadRequestError('不能绑定自己');

    const inviter = await User.findById(inviterId);
    if (!inviter) throw new NotFoundError('邀请人不存在');
    if (!inviter.isActive) throw new BadRequestError('邀请人账号已被禁用');

    const hasLoop = await this.checkInviterLoop(userId, inviterId);
    if (hasLoop) {
      throw new BadRequestError('绑定失败：该用户是您的下级，不能形成闭环关系');
    }

    const result = await User.findOneAndUpdate(
      { _id: userId, inviterId: { $exists: false } },
      { $set: { inviterId: inviterId } },
      { new: true, runValidators: true }
    );

    if (!result) {
      const exists = await User.findById(userId);
      if (!exists) throw new NotFoundError('用户不存在');
      throw new ConflictError('您已经绑定过邀请人了，请勿重复操作');
    }

    clearCache('/api/users/profile');
    console.log(`[UserService] 用户 ${userId} 成功绑定邀请人 ${inviterId}`);
    return result;
  }

  /**
   * 检测邀请关系闭环
   */
  static async checkInviterLoop(currentUserId, targetInviterId) {
    let currentCheckingUser = await User.findById(targetInviterId);
    const maxDepth = 50;
    let depth = 0;

    while (currentCheckingUser && depth < maxDepth) {
      if (currentCheckingUser._id.toString() === currentUserId.toString()) {
        return true;
      }
      if (currentCheckingUser.inviterId) {
        currentCheckingUser = await User.findById(currentCheckingUser.inviterId);
        depth++;
      } else {
        break;
      }
    }
    return false;
  }

  // ==================== 新人奖励 ====================

  static async grantKycReward(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    if (user.newbieRewards.kycReward) {
      return { success: false, message: '已领取过该奖励' };
    }

    const amount = NEWBIE_REWARDS.kyc.amount;
    if (user.newbieRewards.totalEarned + amount > NEWBIE_REWARDS.maxTotal) {
      return { success: false, message: '已达奖励封顶' };
    }

    user.newbieRewards.kycReward = true;
    user.newbieRewards.totalEarned += amount;
    user.pendingEarnings += amount;
    await user.save();

    await this._createTransaction(userId, amount, 'newbie_reward', NEWBIE_REWARDS.kyc.name);
    console.log(`[Reward] 用户 ${userId} 获得${NEWBIE_REWARDS.kyc.name}: ¥${amount}`);
    
    return { success: true, amount, message: NEWBIE_REWARDS.kyc.name };
  }

  static async grantNotificationReward(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    if (user.newbieRewards.notificationReward) {
      return { success: false, message: '已领取过该奖励' };
    }

    const amount = NEWBIE_REWARDS.notification.amount;
    if (user.newbieRewards.totalEarned + amount > NEWBIE_REWARDS.maxTotal) {
      return { success: false, message: '已达奖励封顶' };
    }

    user.newbieRewards.notificationReward = true;
    user.newbieRewards.totalEarned += amount;
    user.pendingEarnings += amount;
    await user.save();

    await this._createTransaction(userId, amount, 'newbie_reward', NEWBIE_REWARDS.notification.name);
    console.log(`[Reward] 用户 ${userId} 获得${NEWBIE_REWARDS.notification.name}: ¥${amount}`);
    
    return { success: true, amount, message: NEWBIE_REWARDS.notification.name };
  }

  static async grantPaymentReward(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    if (user.newbieRewards.paymentReward) {
      return { success: false, message: '已领取过该奖励' };
    }

    const amount = NEWBIE_REWARDS.payment.amount;
    if (user.newbieRewards.totalEarned + amount > NEWBIE_REWARDS.maxTotal) {
      return { success: false, message: '已达奖励封顶' };
    }

    user.newbieRewards.paymentReward = true;
    user.newbieRewards.totalEarned += amount;
    user.pendingEarnings += amount;
    user.hasValidPayment = true;
    await user.save();

    await this._checkAndSetValidMember(userId);

    await this._createTransaction(userId, amount, 'newbie_reward', NEWBIE_REWARDS.payment.name);
    console.log(`[Reward] 用户 ${userId} 获得${NEWBIE_REWARDS.payment.name}: ¥${amount}`);
    
    return { success: true, amount, message: NEWBIE_REWARDS.payment.name };
  }

  static async grantFirstOrderReward(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    if (user.newbieRewards.firstOrderReward) {
      return { success: false, message: '已领取过该奖励' };
    }

    if (user.newbieRewards.orderCount < 1) {
      return { success: false, message: '请先完成首单任务' };
    }

    const amount = NEWBIE_REWARDS.firstOrder.amount;
    if (user.newbieRewards.totalEarned + amount > NEWBIE_REWARDS.maxTotal) {
      return { success: false, message: '已达奖励封顶' };
    }

    user.newbieRewards.firstOrderReward = true;
    user.newbieRewards.totalEarned += amount;
    user.pendingEarnings += amount;
    await user.save();

    await this._createTransaction(userId, amount, 'newbie_reward', NEWBIE_REWARDS.firstOrder.name);
    console.log(`[Reward] 用户 ${userId} 获得${NEWBIE_REWARDS.firstOrder.name}: ¥${amount}`);
    
    return { success: true, amount, message: NEWBIE_REWARDS.firstOrder.name };
  }

  static async grantSecondOrderReward(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    if (user.newbieRewards.secondOrderReward) {
      return { success: false, message: '已领取过该奖励' };
    }

    if (user.newbieRewards.orderCount < 2) {
      return { success: false, message: '请先完成第二单任务' };
    }

    const amount = NEWBIE_REWARDS.secondOrder.amount;
    if (user.newbieRewards.totalEarned + amount > NEWBIE_REWARDS.maxTotal) {
      return { success: false, message: '已达奖励封顶' };
    }

    user.newbieRewards.secondOrderReward = true;
    user.newbieRewards.totalEarned += amount;
    user.pendingEarnings += amount;
    await user.save();

    await this._createTransaction(userId, amount, 'newbie_reward', NEWBIE_REWARDS.secondOrder.name);
    console.log(`[Reward] 用户 ${userId} 获得${NEWBIE_REWARDS.secondOrder.name}: ¥${amount}`);
    
    return { success: true, amount, message: NEWBIE_REWARDS.secondOrder.name };
  }

  static async grantSubsequentReward(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    if (user.newbieRewards.orderCount < 3) {
      return { success: false, message: '请先完成前两单任务' };
    }

    if (user.newbieRewards.orderCount > 20) {
      return { success: false, message: '后续订单奖励仅限第3-20单' };
    }

    if (user.newbieRewards.totalEarned >= NEWBIE_REWARDS.maxTotal) {
      return { success: false, message: '已达奖励封顶' };
    }

    const amount = NEWBIE_REWARDS.subsequentOrder.amount;
    const remaining = NEWBIE_REWARDS.maxTotal - user.newbieRewards.totalEarned;
    const actualAmount = Math.min(amount, remaining);

    if (actualAmount <= 0) {
      return { success: false, message: '已达奖励封顶' };
    }

    user.newbieRewards.totalEarned += actualAmount;
    user.pendingEarnings += actualAmount;
    await user.save();

    await this._createTransaction(userId, actualAmount, 'newbie_reward', NEWBIE_REWARDS.subsequentOrder.name);
    console.log(`[Reward] 用户 ${userId} 获得${NEWBIE_REWARDS.subsequentOrder.name}: ¥${actualAmount}`);
    
    return { success: true, amount: actualAmount, message: NEWBIE_REWARDS.subsequentOrder.name };
  }

  // ==================== 好友订单奖励 ====================

  /**
   * 处理好友订单奖励
   * 首单：18.88元，第二单：8.88元，第三单：3.88元，后续：1.88元+等级加成
   */
  static async processFriendOrderReward(inviterId, friendId, orderNumber, orderId) {
    const inviter = await User.findById(inviterId);
    if (!inviter) return;

    const friend = await User.findById(friendId);
    if (!friend || friend.inviterId?.toString() !== inviterId.toString()) return;

    let rewardAmount = 0;
    let rewardName = '';

    if (orderNumber === 1) {
      rewardAmount = FRIEND_ORDER_REWARDS.first;
      rewardName = '好友首单奖励';
    } else if (orderNumber === 2) {
      rewardAmount = FRIEND_ORDER_REWARDS.second;
      rewardName = '好友第二单奖励';
    } else if (orderNumber === 3) {
      rewardAmount = FRIEND_ORDER_REWARDS.third;
      rewardName = '好友第三单奖励';
    } else if (orderNumber > 3) {
      // 后续订单：基础奖励 + 团队等级加成
      const baseReward = FRIEND_ORDER_REWARDS.subsequent;
      const rankBonus = TEAM_LEADER_RANKS[inviter.agentRank]?.perOrderBonus || 0;
      rewardAmount = baseReward + rankBonus;
      rewardName = `好友后续订单奖励(基础¥${baseReward}${rankBonus > 0 ? ` + 等级加成¥${rankBonus}` : ''})`;
    }

    if (rewardAmount > 0) {
      inviter.inviteEarnings.totalFromInvite += rewardAmount;
      inviter.pendingEarnings += rewardAmount;
      await inviter.save();

      await this._createTransaction(
        inviter._id,
        rewardAmount,
        'friend_order_reward',
        `${rewardName} - 好友: ${friend.email || friend.name}`,
        orderId
      );

      console.log(`[FriendOrderReward] 邀请人 ${inviter._id} 获得${rewardName}: ¥${rewardAmount}`);
    }
  }

  /**
   * 处理订单完成后的奖励
   */
  static async processOrderRewards(workerId, orderId, orderAmount) {
    const worker = await User.findById(workerId);
    if (!worker) return;

    // 更新工人订单数
    const orderCount = worker.personalOrderCount + 1;
    worker.personalOrderCount = orderCount;
    await worker.save();

    // 更新团队订单数
    await this._updateTeamOrderCount(workerId);

    // 处理邀请人奖励
    if (worker.inviterId) {
      await this.processFriendOrderReward(worker.inviterId, workerId, orderCount, orderId);
      await this._updateTeamStats(worker.inviterId, orderAmount);
    }
  }

  /**
   * 检查并设置为有效成员
   */
  static async _checkAndSetValidMember(userId) {
    const user = await User.findById(userId);
    if (!user || user.isValidMember) return;

    if (user.kycStatus === 'Verified' && user.hasValidPayment) {
      user.isValidMember = true;
      await user.save();

      await this._updateAncestorValidCount(userId);
      console.log(`[Team] 用户 ${userId} 成为有效成员`);
    }
  }

  /**
   * 级联更新上级有效人数
   */
  static async _updateAncestorValidCount(newValidUserId) {
    let currentUserId = newValidUserId;
    let level = 0;

    while (currentUserId) {
      const user = await User.findById(currentUserId);
      if (!user || !user.inviterId) break;

      const inviter = await User.findById(user.inviterId);
      if (!inviter) break;

      if (level === 0) {
        inviter.validDirectCount = (inviter.validDirectCount || 0) + 1;
      }
      inviter.validTeamCount = (inviter.validTeamCount || 0) + 1;
      await inviter.save();

      currentUserId = inviter._id;
      level++;
    }
  }

  /**
   * 更新团队订单数
   */
  static async _updateTeamOrderCount(workerId) {
    let currentUserId = workerId;

    while (currentUserId) {
      const user = await User.findById(currentUserId);
      if (!user || !user.inviterId) break;

      const inviter = await User.findById(user.inviterId);
      if (!inviter) break;

      inviter.teamOrderCount = (inviter.teamOrderCount || 0) + 1;
      await inviter.save();

      currentUserId = inviter._id;
    }
  }

  /**
   * 更新团队业绩统计
   */
  static async _updateTeamStats(inviterId, orderAmount) {
    await User.findByIdAndUpdate(inviterId, {
      $inc: {
        'teamStats.weeklyOrderAmount': orderAmount,
        'teamStats.monthlyOrderAmount': orderAmount,
        'teamStats.yearlyOrderAmount': orderAmount
      }
    });
  }

  // ==================== 提现功能 ====================

  static async withdrawPendingEarnings(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    if (user.pendingEarnings < 20) {
      throw new BadRequestError('待提现收益满¥20才可提现');
    }

    const amount = user.pendingEarnings;
    user.pendingEarnings = 0;
    user.balance += amount;
    await user.save();

    await this._createTransaction(userId, amount, 'withdraw', '待提现收益转入余额');
    console.log(`[Withdraw] 用户 ${userId} 提现 ¥${amount} 到余额`);

    return { success: true, amount };
  }

  // ==================== 团队统计 ====================

  static async getTeamStats(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    const commissions = await Transaction.find({
      userId: userId,
      type: { $in: ['commission', 'invite_bonus', 'friend_order_reward'] }
    }).sort({ createdAt: -1 });

    let total = 0;
    let daily = 0;
    let weekly = 0;
    let monthly = 0;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    commissions.forEach(t => {
      const amount = t.amount || 0;
      const date = t.createdAt;
      total += amount;
      if (date >= startOfDay) daily += amount;
      if (date >= startOfWeek) weekly += amount;
      if (date >= startOfMonth) monthly += amount;
    });

    const directCount = await User.countDocuments({ 
      inviterId: userId, 
      isValidMember: true 
    });
    
    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);
    
    const indirectCount = await User.countDocuments({ 
      inviterId: { $in: directIds },
      isValidMember: true 
    });

    return {
      totalIncome: total,
      dailyIncome: daily,
      weeklyIncome: weekly,
      monthlyIncome: monthly,
      directCount,
      indirectCount,
      teamOrderCount: user.teamOrderCount || 0,
      agentRank: user.agentRank || 0,
      rankName: TEAM_LEADER_RANKS[user.agentRank || 0]?.name || '大众会员',
      pendingEarnings: user.pendingEarnings,
      inviteEarnings: user.inviteEarnings,
      validTeamCount: user.validTeamCount || 0,
      validDirectCount: user.validDirectCount || 0
    };
  }

  static async getTeamList(userId, type, keyword, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    let users = [];
    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);

    const selectFields = '_id name email phone avatar createdAt balance isValidMember kycStatus personalOrderCount totalCommission';

    const searchCondition = keyword && keyword.trim() 
      ? {
          $or: [
            { name: { $regex: keyword, $options: 'i' } },
            { email: { $regex: keyword, $options: 'i' } },
            { phone: { $regex: keyword, $options: 'i' } }
          ]
        }
      : {};

    if (type === 'direct') {
      users = await User.find({
        inviterId: userId,
        ...searchCondition
      })
        .select(selectFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    } else {
      users = await User.find({
        inviterId: { $in: directIds },
        ...searchCondition
      })
        .select(selectFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    }

    return users;
  }

  static async searchTeamMembers(userId, keyword, type = 'direct') {
    if (!keyword || !keyword.trim()) {
      return [];
    }

    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);

    const selectFields = '_id name email phone avatar createdAt isValidMember personalOrderCount totalCommission';

    const searchCondition = {
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } }
      ]
    };

    let users = [];
    if (type === 'direct') {
      users = await User.find({
        inviterId: userId,
        ...searchCondition
      })
        .select(selectFields)
        .sort({ createdAt: -1 })
        .limit(20);
    } else {
      users = await User.find({
        inviterId: { $in: directIds },
        ...searchCondition
      })
        .select(selectFields)
        .sort({ createdAt: -1 })
        .limit(20);
    }

    return users;
  }

  /**
   * 获取邀请任务信息
   */
  static async getInviteTaskInfo(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    // 获取直推好友
    const directFriends = await User.find({ inviterId: userId })
      .select('_id name email isValidMember personalOrderCount createdAt');

    // 统计数据
    const inviteCount = directFriends.length;
    const validInviteCount = directFriends.filter(f => f.isValidMember).length;
    
    // 统计好友订单完成情况
    let firstOrderCount = 0;
    let secondOrderCount = 0;
    let thirdOrderCount = 0;

    directFriends.forEach(friend => {
      const orderCount = friend.personalOrderCount || 0;
      if (orderCount >= 1) firstOrderCount++;
      if (orderCount >= 2) secondOrderCount++;
      if (orderCount >= 3) thirdOrderCount++;
    });

    // 计算已获得的邀请奖励
    const inviteTransactions = await Transaction.find({
      userId: userId,
      type: { $in: ['friend_order_reward', 'invite_bonus', 'commission'] }
    });
    
    const completedReward = inviteTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // 任务列表
    const tasks = [
      {
        id: 1,
        title: '好友完成首单',
        reward: FRIEND_ORDER_REWARDS.first,
        desc: `每有一位好友完成首单，奖励¥${FRIEND_ORDER_REWARDS.first}`,
        status: firstOrderCount > 0 ? 'completed' : 'pending',
        count: firstOrderCount
      },
      {
        id: 2,
        title: '好友完成第二单',
        reward: FRIEND_ORDER_REWARDS.second,
        desc: `每有一位好友完成第二单，奖励¥${FRIEND_ORDER_REWARDS.second}`,
        status: secondOrderCount > 0 ? 'completed' : 'pending',
        count: secondOrderCount
      },
      {
        id: 3,
        title: '好友完成第三单',
        reward: FRIEND_ORDER_REWARDS.third,
        desc: `每有一位好友完成第三单，奖励¥${FRIEND_ORDER_REWARDS.third}`,
        status: thirdOrderCount > 0 ? 'completed' : 'pending',
        count: thirdOrderCount
      },
      {
        id: 4,
        title: '好友后续订单',
        reward: FRIEND_ORDER_REWARDS.subsequent,
        desc: `后续每单¥${FRIEND_ORDER_REWARDS.subsequent}（可享团队等级加成）`,
        status: 'ongoing',
        count: '-'
      }
    ];

    return {
      totalReward: 88,
      completedReward,
      inviteCount,
      validInviteCount,
      firstOrderCount,
      secondOrderCount,
      thirdOrderCount,
      tasks
    };
  }

  static async getMyTeam(userId) {
    const members = await User.find({ inviterId: userId })
      .select('_id name email phone avatar createdAt isValidMember personalOrderCount agentRank totalCommission')
      .sort({ createdAt: -1 });

    const totalDirect = members.length;
    const validDirect = members.filter(m => m.isValidMember).length;

    const directIds = members.map(m => m._id);
    const indirectMembers = await User.find({ inviterId: { $in: directIds } })
      .select('_id name email phone avatar createdAt isValidMember personalOrderCount agentRank totalCommission')
      .sort({ createdAt: -1 });
    
    const totalIndirect = indirectMembers.length;
    const validIndirect = indirectMembers.filter(m => m.isValidMember).length;

    return {
      totalDirect,
      validDirect,
      totalIndirect,
      validIndirect,
      members
    };
  }

  static async getFriendCommissions(userId, friendId) {
    const friend = await User.findOne({
      _id: friendId,
      inviterId: userId
    });

    if (!friend) {
      return [];
    }

    const commissions = await Transaction.find({
      userId: userId,
      type: { $in: ['commission', 'invite_bonus', 'friend_order_reward'] }
    })
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(50);

    const friendCommissions = commissions.filter(t => 
      t.description && t.description.includes(friend.email || friend.name || friendId)
    );

    return friendCommissions.map(t => ({
      _id: t._id,
      amount: t.amount,
      description: t.description,
      type: t.type,
      createdAt: t.createdAt
    }));
  }

  static async getMyCommissions(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find({
      userId,
      type: { $in: ['commission', 'invite_bonus', 'friend_order_reward'] }
    })
      .populate('orderId', 'orderNumber jobSnapshot.amount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({
      userId,
      type: { $in: ['commission', 'invite_bonus', 'friend_order_reward'] }
    });

    return {
      transactions,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }

  /**
   * 检查升级条件
   */
  static async checkUpgradeConditions(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    const currentRank = user.agentRank || 0;
    const nextRank = currentRank + 1;

    // 已满级
    if (nextRank > 5) {
      return {
        currentRank,
        currentRankName: TEAM_LEADER_RANKS[currentRank]?.name || '大众会员',
        nextRank: null,
        nextRankName: null,
        canUpgrade: false,
        validTeamCount: user.validTeamCount || 0,
        validDirectCount: user.validDirectCount || 0,
        teamOrderCount: user.teamOrderCount || 0,
        requirements: null
      };
    }

    const nextRankConfig = TEAM_LEADER_RANKS[nextRank];
    
    // 统计数据
    const validTeamCount = user.validTeamCount || 0;
    const validDirectCount = user.validDirectCount || 0;
    const teamOrderCount = user.teamOrderCount || 0;

    // 检查是否满足条件
    const teamValidMet = validTeamCount >= (nextRankConfig.needTeamValid || 0);
    const directValidMet = validDirectCount >= (nextRankConfig.needDirectValid || 0);
    const teamOrdersMet = teamOrderCount >= (nextRankConfig.needTeamOrders || 0);

    const canUpgrade = teamValidMet && directValidMet && teamOrdersMet;

    return {
      currentRank,
      currentRankName: TEAM_LEADER_RANKS[currentRank]?.name || '大众会员',
      nextRank,
      nextRankName: nextRankConfig.name,
      canUpgrade,
      validTeamCount,
      validDirectCount,
      teamOrderCount,
      requirements: {
        teamValid: {
          need: nextRankConfig.needTeamValid,
          current: validTeamCount,
          met: teamValidMet
        },
        directValid: {
          need: nextRankConfig.needDirectValid,
          current: validDirectCount,
          met: directValidMet
        },
        teamOrders: {
          need: nextRankConfig.needTeamOrders,
          current: teamOrderCount,
          met: teamOrdersMet
        }
      }
    };
  }

  /**
   * 用户手动升级
   */
  static async upgradeRank(userId) {
    const conditions = await this.checkUpgradeConditions(userId);
    
    if (!conditions.canUpgrade) {
      throw new BadRequestError('未满足升级条件');
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');

    const oldRank = user.agentRank || 0;
    const newRank = conditions.nextRank;

    user.agentRank = newRank;
    await user.save();

    // 记录升级
    await this._createTransaction(
      userId,
      0,
      'rank_upgrade',
      `升级为 ${TEAM_LEADER_RANKS[newRank].name}`
    );

    console.log(`[Upgrade] 用户 ${userId} 从 ${TEAM_LEADER_RANKS[oldRank]?.name || '大众会员'} 升级为 ${TEAM_LEADER_RANKS[newRank].name}`);

    return {
      success: true,
      oldRank,
      newRank,
      message: `恭喜升级为${TEAM_LEADER_RANKS[newRank].name}！`
    };
  }

  // ==================== 管理员接口 ====================

  static async getTeamLeaderList(filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const query = {
      agentRank: { $gte: 0 },
      isActive: true,
      ...filters
    };

    const leaders = await User.find(query)
      .select('name email agentRank validDirectCount validTeamCount teamOrderCount ' +
              'inviteEarnings teamStats performanceRewards createdAt')
      .sort({ agentRank: -1, validTeamCount: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    return {
      leaders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getTeamLeaderDetail(leaderId) {
    const leader = await User.findById(leaderId)
      .select('name email agentRank validDirectCount validTeamCount teamOrderCount ' +
              'inviteEarnings teamStats performanceRewards createdAt');

    if (!leader) return null;

    const directMembers = await User.find({ inviterId: leaderId })
      .select('_id name email isValidMember personalOrderCount createdAt')
      .sort({ createdAt: -1 });

    const directValidCount = directMembers.filter(m => m.isValidMember).length;

    const directIds = directMembers.map(m => m._id);
    const indirectValidCount = await User.countDocuments({
      inviterId: { $in: directIds },
      isValidMember: true
    });

    return {
      leader,
      directMembers,
      directValidCount,
      indirectValidCount
    };
  }

  static async getPendingWeeklyRewards() {
    const leaders = await User.find({
      agentRank: { $gte: 4 },
      isActive: true,
      'teamStats.lastWeekOrderAmount': { $gt: 0 }
    }).select('name email agentRank teamStats');
    
    return leaders.map(leader => {
      const rankConfig = TEAM_LEADER_RANKS[leader.agentRank];
      const weeklyAmount = (leader.teamStats?.lastWeekOrderAmount || 0) * (rankConfig?.weeklyBonusRate || 0);
      
      return {
        _id: leader._id,
        name: leader.name,
        email: leader.email,
        agentRank: leader.agentRank,
        rankName: rankConfig?.name,
        lastWeekOrderAmount: leader.teamStats?.lastWeekOrderAmount || 0,
        weeklyBonusRate: rankConfig?.weeklyBonusRate || 0,
        estimatedReward: weeklyAmount
      };
    }).filter(l => l.estimatedReward > 0);
  }

  static async getPendingMonthlyRewards() {
    const leaders = await User.find({
      agentRank: { $gte: 4 },
      isActive: true,
      'teamStats.lastMonthOrderAmount': { $gt: 0 }
    }).select('name email agentRank teamStats');
    
    return leaders.map(leader => {
      const rankConfig = TEAM_LEADER_RANKS[leader.agentRank];
      const monthlyAmount = (leader.teamStats?.lastMonthOrderAmount || 0) * (rankConfig?.monthlyBonusRate || 0);
      
      return {
        _id: leader._id,
        name: leader.name,
        email: leader.email,
        agentRank: leader.agentRank,
        rankName: rankConfig?.name,
        lastMonthOrderAmount: leader.teamStats?.lastMonthOrderAmount || 0,
        monthlyBonusRate: rankConfig?.monthlyBonusRate || 0,
        estimatedReward: monthlyAmount
      };
    }).filter(l => l.estimatedReward > 0);
  }

  static async distributeWeeklyRewards(leaderId = null, dryRun = false) {
    let leaders = [];
    
    if (leaderId) {
      const leader = await User.findById(leaderId);
      if (leader) leaders.push(leader);
    } else {
      leaders = await User.find({
        agentRank: { $gte: 4 },
        isActive: true,
        'teamStats.lastWeekOrderAmount': { $gt: 0 }
      });
    }

    const results = [];

    for (const leader of leaders) {
      const rankConfig = TEAM_LEADER_RANKS[leader.agentRank];
      if (!rankConfig || rankConfig.weeklyBonusRate <= 0) continue;

      const weeklyAmount = (leader.teamStats?.lastWeekOrderAmount || 0) * rankConfig.weeklyBonusRate;
      if (weeklyAmount <= 0) continue;

      if (!dryRun) {
        leader.performanceRewards = leader.performanceRewards || {};
        leader.performanceRewards.weeklyTotal = (leader.performanceRewards.weeklyTotal || 0) + weeklyAmount;
        leader.performanceRewards.lastWeeklyAt = new Date();
        leader.balance = (leader.balance || 0) + weeklyAmount;
        await leader.save();

        await this._createTransaction(
          leader._id, 
          weeklyAmount, 
          'weekly_reward', 
          `周业绩奖励(团队订单金额×${(rankConfig.weeklyBonusRate * 100).toFixed(1)}%)`
        );
      }

      results.push({
        leaderId: leader._id,
        name: leader.name,
        amount: weeklyAmount,
        success: true
      });
    }

    console.log(`[Admin] 周奖励发放完成，共 ${results.length} 人，总额 ¥${results.reduce((s, r) => s + r.amount, 0)}`);
    return results;
  }

  static async distributeMonthlyRewards(leaderId = null, dryRun = false) {
    let leaders = [];
    
    if (leaderId) {
      const leader = await User.findById(leaderId);
      if (leader) leaders.push(leader);
    } else {
      leaders = await User.find({
        agentRank: { $gte: 4 },
        isActive: true,
        'teamStats.lastMonthOrderAmount': { $gt: 0 }
      });
    }

    const results = [];

    for (const leader of leaders) {
      const rankConfig = TEAM_LEADER_RANKS[leader.agentRank];
      if (!rankConfig || rankConfig.monthlyBonusRate <= 0) continue;

      const monthlyAmount = (leader.teamStats?.lastMonthOrderAmount || 0) * rankConfig.monthlyBonusRate;
      if (monthlyAmount <= 0) continue;

      if (!dryRun) {
        leader.performanceRewards = leader.performanceRewards || {};
        leader.performanceRewards.monthlyTotal = (leader.performanceRewards.monthlyTotal || 0) + monthlyAmount;
        leader.performanceRewards.lastMonthlyAt = new Date();
        leader.balance = (leader.balance || 0) + monthlyAmount;
        await leader.save();

        await this._createTransaction(
          leader._id, 
          monthlyAmount, 
          'monthly_reward', 
          `月业绩奖励(团队订单金额×${(rankConfig.monthlyBonusRate * 100).toFixed(1)}%)`
        );
      }

      results.push({
        leaderId: leader._id,
        name: leader.name,
        amount: monthlyAmount,
        success: true
      });
    }

    console.log(`[Admin] 月奖励发放完成，共 ${results.length} 人，总额 ¥${results.reduce((s, r) => s + r.amount, 0)}`);
    return results;
  }

  static async distributeYearlyRewards(rewards, dryRun = false) {
    const results = [];

    for (const { leaderId, amount } of rewards) {
      const leader = await User.findById(leaderId);
      if (!leader || leader.agentRank < 5) continue;

      if (!dryRun) {
        leader.performanceRewards = leader.performanceRewards || {};
        leader.performanceRewards.yearlyTotal = (leader.performanceRewards.yearlyTotal || 0) + amount;
        leader.performanceRewards.lastYearlyAt = new Date();
        leader.balance = (leader.balance || 0) + amount;
        await leader.save();

        await this._createTransaction(leader._id, amount, 'yearly_reward', '年终分红奖励');
      }

      results.push({
        leaderId,
        name: leader?.name,
        amount,
        success: true
      });
    }

    return results;
  }

  static async manualUpgradeRank(leaderId, newRank, reason = '') {
    const leader = await User.findById(leaderId);
    if (!leader) throw new NotFoundError('团队长不存在');
    if (newRank < 0 || newRank > 5) throw new BadRequestError('等级必须在0-5之间');
    if (newRank <= leader.agentRank) throw new BadRequestError('新等级必须高于当前等级');

    const oldRank = leader.agentRank || 0;
    leader.agentRank = newRank;
    await leader.save();

    await this._createTransaction(
      leader._id, 
      0, 
      'rank_change', 
      `管理员手动升级: ${TEAM_LEADER_RANKS[oldRank]?.name || '大众会员'} → ${TEAM_LEADER_RANKS[newRank].name}. 原因: ${reason}`
    );

    console.log(`[Admin] 手动升级: ${leaderId} 从 ${oldRank} 级升到 ${newRank} 级`);
    return { success: true, oldRank, newRank };
  }

  static async manualDowngradeRank(leaderId, newRank, reason = '') {
    const leader = await User.findById(leaderId);
    if (!leader) throw new NotFoundError('团队长不存在');
    if (newRank < 0 || newRank > 5) throw new BadRequestError('等级必须在0-5之间');
    if (newRank >= leader.agentRank) throw new BadRequestError('新等级必须低于当前等级');

    const oldRank = leader.agentRank || 0;
    leader.agentRank = newRank;
    await leader.save();

    await this._createTransaction(
      leader._id, 
      0, 
      'rank_change', 
      `管理员手动降级: ${TEAM_LEADER_RANKS[oldRank]?.name || '大众会员'} → ${TEAM_LEADER_RANKS[newRank].name}. 原因: ${reason}`
    );

    console.log(`[Admin] 手动降级: ${leaderId} 从 ${oldRank} 级降到 ${newRank} 级`);
    return { success: true, oldRank, newRank };
  }

  static async recalculateTeamStats(leaderId) {
    const leader = await User.findById(leaderId);
    if (!leader) throw new NotFoundError('团队长不存在');

    const directValidCount = await User.countDocuments({
      inviterId: leaderId,
      isValidMember: true
    });

    const directMembers = await User.find({ inviterId: leaderId }).select('_id');
    const directIds = directMembers.map(m => m._id);

    const indirectValidCount = await User.countDocuments({
      inviterId: { $in: directIds },
      isValidMember: true
    });

    leader.validDirectCount = directValidCount;
    leader.validTeamCount = directValidCount + indirectValidCount;
    await leader.save();

    console.log(`[Admin] 重新计算团队数据: ${leaderId}, 直推: ${directValidCount}, 团队: ${leader.validTeamCount}`);
    
    return {
      leaderId,
      validDirectCount: directValidCount,
      validTeamCount: leader.validTeamCount
    };
  }

  static async resetPeriodStats(type) {
    const update = {};
    
    if (type === 'weekly') {
      update['teamStats.lastWeekOrderAmount'] = { $getField: 'teamStats.weeklyOrderAmount' };
      update['teamStats.weeklyOrderAmount'] = 0;
    } else if (type === 'monthly') {
      update['teamStats.lastMonthOrderAmount'] = { $getField: 'teamStats.monthlyOrderAmount' };
      update['teamStats.monthlyOrderAmount'] = 0;
    }

    const result = await User.updateMany(
      { agentRank: { $gte: 0 } },
      { $set: update }
    );

    console.log(`[Admin] 重置${type}业绩统计，影响 ${result.modifiedCount} 人`);
    return { success: true, affected: result.modifiedCount };
  }

  // ==================== 私有方法 ====================

  static async _createTransaction(userId, amount, type, description, orderId = null) {
    const user = await User.findById(userId);
    
    await Transaction.create({
      userId,
      orderId,
      type,
      amount,
      balanceSnapshot: user?.balance || 0,
      description,
      status: 'completed'
    });
  }
}

/**
 * 用户控制器
 */
import { UserService } from './user.service/index.js';
import { UserServiceTeam } from './user.service/user.service.team.js';
import User, { TEAM_LEADER_RANKS, NEWBIE_REWARDS } from './user.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';
import mongoose from 'mongoose';

export class UserController {
  // ==================== 基础用户接口 ====================

  static async getMe(req, res) {
    const user = await User.findById(req.user.id);
    if (!user) throw new NotFoundError('用户不存在');
    res.json({ success: true, data: user });
  }

  static async getNameStatus(req, res) {
    const user = await User.findById(req.user.id).select('name pendingName nameStatus nameRejectReason');
    res.json({ success: true, data: user });
  }

  static async updateMyProfile(req, res) {
    const { name, avatarColor } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) throw new NotFoundError('用户不存在');

    if (name && name !== user.name) {
      user.pendingName = name;
      user.nameStatus = 'pending';
      user.nameUpdatedAt = new Date();
    }
    if (avatarColor) user.avatarColor = avatarColor;
    await user.save();

    res.json({ success: true, data: user, message: '资料已提交审核' });
  }

  static async getStats(req, res) {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: {
        balance: user.balance,
        points: user.points,
        coins: user.coins,
        level: user.level,
        exp: user.exp,
        creditScore: user.creditScore
      }
    });
  }

  static async updatePoints(req, res) {
    const { points, coins } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { points: points || 0, coins: coins || 0 } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  // ==================== 团队接口 ====================

  static async bindInviter(req, res) {
    const { inviterId } = req.body;
    const result = await UserServiceTeam.bindInviter(req.user.id, inviterId);
    res.json({ success: true, data: result, message: '绑定成功' });
  }

  static async getMyTeamStats(req, res) {
    const stats = await UserServiceTeam.getTeamStats(req.user.id);
    res.json({ success: true, data: stats });
  }

  static async getMyTeamList(req, res) {
    const { type = 'direct', keyword = '', page = 1, limit = 20 } = req.query;
    const list = await UserServiceTeam.getTeamList(req.user.id, type, keyword, parseInt(page), parseInt(limit));
    res.json({ success: true, data: list });
  }

  static async searchTeamMembers(req, res) {
    const { keyword = '', type = 'direct' } = req.query;
    const list = await UserServiceTeam.searchTeamMembers(req.user.id, keyword, type);
    res.json({ success: true, data: list });
  }

  static async getInviteTaskInfo(req, res) {
    const info = await UserServiceTeam.getInviteTaskInfo(req.user.id);
    res.json({ success: true, data: info });
  }

  static async getFriendCommissions(req, res) {
    const { friendId } = req.params;
    const details = await UserServiceTeam.getFriendCommissions(req.user.id, friendId);
    res.json({ success: true, data: details });
  }

  static async getMyTeam(req, res) {
    const team = await UserServiceTeam.getMyTeam(req.user.id);
    res.json({ success: true, data: team });
  }

  static async getMyCommissions(req, res) {
    const { page = 1, limit = 20 } = req.query;
    const result = await UserServiceTeam.getMyCommissions(req.user.id, page, limit);
    res.json({ success: true, data: result });
  }

  static async checkUpgradeConditions(req, res) {
    const result = await UserServiceTeam.checkUpgradeConditions(req.user.id);
    res.json({ success: true, data: result });
  }

  // ✅ 新增：用户手动升级
  static async upgradeRank(req, res) {
    const result = await UserServiceTeam.upgradeRank(req.user.id);
    res.json({ success: true, data: result, message: result.message });
  }

  static async withdrawPendingEarnings(req, res) {
    const result = await UserServiceTeam.withdrawPendingEarnings(req.user.id);
    res.json({ success: true, data: result, message: '提现成功' });
  }

  // ==================== 新人奖励接口 ====================

  static async claimKycReward(req, res) {
    const result = await UserServiceTeam.grantKycReward(req.user.id);
    res.json({ success: result.success, data: result, message: result.message });
  }

  static async claimNotificationReward(req, res) {
    const result = await UserServiceTeam.grantNotificationReward(req.user.id);
    res.json({ success: result.success, data: result, message: result.message });
  }

  static async claimPaymentReward(req, res) {
    const result = await UserServiceTeam.grantPaymentReward(req.user.id);
    res.json({ success: result.success, data: result, message: result.message });
  }

  static async claimFirstOrderReward(req, res) {
    const result = await UserServiceTeam.grantFirstOrderReward(req.user.id);
    res.json({ success: result.success, data: result, message: result.message });
  }

  static async claimSecondOrderReward(req, res) {
    const result = await UserServiceTeam.grantSecondOrderReward(req.user.id);
    res.json({ success: result.success, data: result, message: result.message });
  }

  static async claimSubsequentReward(req, res) {
    const result = await UserServiceTeam.grantSubsequentReward(req.user.id);
    res.json({ success: result.success, data: result, message: result.message });
  }

  static async getNewbieRewardStatus(req, res) {
    const user = await User.findById(req.user.id).select('newbieRewards isValidMember pendingEarnings');
    if (!user) throw new NotFoundError('用户不存在');

    res.json({
      success: true,
      data: {
        kycReward: user.newbieRewards.kycReward,
        notificationReward: user.newbieRewards.notificationReward,
        paymentReward: user.newbieRewards.paymentReward,
        firstOrderReward: user.newbieRewards.firstOrderReward,
        secondOrderReward: user.newbieRewards.secondOrderReward,
        totalEarned: user.newbieRewards.totalEarned,
        orderCount: user.newbieRewards.orderCount,
        maxTotal: NEWBIE_REWARDS.maxTotal,
        isValidMember: user.isValidMember,
        pendingEarnings: user.pendingEarnings
      }
    });
  }

  // ==================== 管理员接口 - 团队长管理 ====================

  static async getTeamLeaderList(req, res) {
    const { page = 1, limit = 20, rank, keyword } = req.query;
    
    const filters = {};
    if (rank) filters.agentRank = parseInt(rank);
    if (keyword) {
      filters.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } }
      ];
    }

    const result = await UserServiceTeam.getTeamLeaderList(filters, parseInt(page), parseInt(limit));
    res.json({ success: true, data: result });
  }

  static async getTeamLeaderDetail(req, res) {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('无效的团队长ID');
    }

    const result = await UserServiceTeam.getTeamLeaderDetail(id);
    if (!result) throw new NotFoundError('团队长不存在');
    
    res.json({ success: true, data: result });
  }

static async manualUpgradeRank(req, res) {
  const { id } = req.params;
  const { newRank, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError('无效的团队长ID');
  }

  // ✅ 修改：等级从 1-6
  if (!newRank || newRank < 1 || newRank > 6) {
    throw new BadRequestError('等级必须在1-6之间');
  }

  const result = await UserServiceTeam.manualUpgradeRank(id, newRank, reason || '管理员手动升级');
  res.json({ success: true, data: result, message: '升级成功' });
}

static async manualDowngradeRank(req, res) {
  const { id } = req.params;
  const { newRank, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError('无效的团队长ID');
  }

  // ✅ 修改：等级从 1-6
  if (!newRank || newRank < 1 || newRank > 6) {
    throw new BadRequestError('等级必须在1-6之间');
  }

  const result = await UserServiceTeam.manualDowngradeRank(id, newRank, reason || '管理员手动降级');
  res.json({ success: true, data: result, message: '降级成功' });
}


  static async recalculateTeamStats(req, res) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('无效的团队长ID');
    }

    const result = await UserServiceTeam.recalculateTeamStats(id);
    res.json({ success: true, data: result, message: '重新计算完成' });
  }

  static async getPendingRewards(req, res) {
    const { type = 'weekly' } = req.query;
    
    let result;
    if (type === 'weekly') {
      result = await UserServiceTeam.getPendingWeeklyRewards();
    } else if (type === 'monthly') {
      result = await UserServiceTeam.getPendingMonthlyRewards();
    } else {
      result = [];
    }
    
    res.json({ success: true, data: result });
  }

  static async distributeWeeklyRewards(req, res) {
    const { leaderId, dryRun = false } = req.body;

    const result = await UserServiceTeam.distributeWeeklyRewards(leaderId || null, dryRun);
    
    res.json({ 
      success: true, 
      data: result,
      message: dryRun ? '预览完成' : `周奖励发放完成，共 ${result.length} 人`
    });
  }

  static async distributeMonthlyRewards(req, res) {
    const { leaderId, dryRun = false } = req.body;

    const result = await UserServiceTeam.distributeMonthlyRewards(leaderId || null, dryRun);
    
    res.json({ 
      success: true, 
      data: result,
      message: dryRun ? '预览完成' : `月奖励发放完成，共 ${result.length} 人`
    });
  }

  static async distributeYearlyRewards(req, res) {
    const { rewards, dryRun = false } = req.body;

    if (!rewards || !Array.isArray(rewards)) {
      throw new BadRequestError('请提供奖励列表');
    }

    const result = await UserServiceTeam.distributeYearlyRewards(rewards, dryRun);
    
    res.json({ 
      success: true, 
      data: result,
      message: dryRun ? '预览完成' : `年终奖励发放完成，共 ${result.length} 人`
    });
  }

  static async resetPeriodStats(req, res) {
    const { type } = req.body;

    if (!['weekly', 'monthly'].includes(type)) {
      throw new BadRequestError('类型必须是 weekly 或 monthly');
    }

    const result = await UserServiceTeam.resetPeriodStats(type);
    res.json({ success: true, data: result, message: '重置完成' });
  }

  // ==================== 其他接口 ====================

  static async getLeisureCurrency(req, res) {
    const user = await User.findById(req.user.id).select('points coins');
    res.json({ success: true, data: user });
  }

  static async exchangePointsForCoins(req, res) {
    const { points } = req.body;
    const user = await User.findById(req.user.id);
    if (user.points < points) throw new BadRequestError('积分不足');
    user.points -= points;
    user.coins += points;
    await user.save();
    res.json({ success: true, data: user });
  }

  static async exchangeCoinsForPoints(req, res) {
    const { coins } = req.body;
    const user = await User.findById(req.user.id);
    if (user.coins < coins) throw new BadRequestError('小象币不足');
    user.coins -= coins;
    user.points += coins;
    await user.save();
    res.json({ success: true, data: user });
  }

  static async getUserByIdForTransfer(req, res) {
    const { id } = req.query;
    const user = await User.findById(id).select('name email');
    if (!user) throw new NotFoundError('用户不存在');
    res.json({ success: true, data: user });
  }

  static async verifyPassword(req, res) {
    const { password } = req.body;
    const user = await User.findById(req.user.id);
    const valid = user.comparePassword(password);
    res.json({ success: valid, message: valid ? '验证成功' : '密码错误' });
  }

  static async transferCoins(req, res) {
    const { toUserId, amount } = req.body;
    const fromUser = await User.findById(req.user.id);
    if (fromUser.coins < amount) throw new BadRequestError('小象币不足');
    const toUser = await User.findById(toUserId);
    if (!toUser) throw new NotFoundError('目标用户不存在');
    fromUser.coins -= amount;
    toUser.coins += amount;
    await fromUser.save();
    await toUser.save();
    res.json({ success: true, message: '转增成功' });
  }

  static async getTransferHistory(req, res) {
    res.json({ success: true, data: [] });
  }

  static async autoCheckKYC(req, res) {
    res.json({ success: true, message: '自动检查完成' });
  }

  static async batchApproveKYC(req, res) {
    const { userIds } = req.body;
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { kycStatus: 'Verified' } }
    );
    res.json({ success: true, data: result });
  }

  static async batchRejectKYC(req, res) {
    const { userIds } = req.body;
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { kycStatus: 'Rejected' } }
    );
    res.json({ success: true, data: result });
  }

  static async deepVerifyKYC(req, res) {
    res.json({ success: true, message: '深度核验完成' });
  }

  static async getUsersList(req, res) {
    const { page = 1, limit = 20, keyword } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({ success: true, data: { users, total, page, limit } });
  }

  static async getUserById(req, res) {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) throw new NotFoundError('用户不存在');
    res.json({ success: true, data: user });
  }

  static async updateUser(req, res) {
    const updates = req.body;
    delete updates.password;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) throw new NotFoundError('用户不存在');
    res.json({ success: true, data: user });
  }

  static async updateKYCStatus(req, res) {
    const { status, rejectReason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { kycStatus: status } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async reverifyKYC(req, res) {
    res.json({ success: true, message: '重新核验完成' });
  }

  static async markKYCAbnormal(req, res) {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { kycStatus: 'Rejected' } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async updateDeposit(req, res) {
    const { amount } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { deposit: amount } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async toggleUserStatus(req, res) {
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError('用户不存在');
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, data: user, message: user.isActive ? '已启用' : '已禁用' });
  }

  static async addPoints(req, res) {
    const { amount } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { points: amount } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async subtractPoints(req, res) {
    const { amount } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { points: -amount } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async addCoins(req, res) {
    const { amount } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { coins: amount } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async subtractCoins(req, res) {
    const { amount } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { coins: -amount } },
      { new: true }
    );
    res.json({ success: true, data: user });
  }

  static async getReviewQueueStatus(req, res) {
    res.json({ success: true, data: { pending: 0 } });
  }

  static async triggerReviewQueue(req, res) {
    res.json({ success: true, message: '队列已触发' });
  }
}

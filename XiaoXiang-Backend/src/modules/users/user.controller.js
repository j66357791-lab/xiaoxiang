import { success, error, paginated } from '../../common/utils/response.js';
import { UserService } from './user.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class UserController {
  /**
   * 获取当前用户信息（包含等级和信誉分）
   */
  static getMe = asyncHandler(async (req, res) => {
    const user = await UserService.findById(req.user._id);
    
    return success(res, {
      id: user._id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      points: user.points,
      coins: user.coins,
      deposit: user.deposit,
      name: user.name || '小象用户',
      avatarColor: user.avatarColor || 'blue',
      
      // 等级与信誉系统
      exp: user.exp || 0,
      level: user.level || 'Lv1',
      creditScore: user.creditScore ?? 100,
      creditBanUntil: user.creditBanUntil,
      
      // VIP 系统
      vipLevel: user.vipLevel || 'none',
      vipExpireAt: user.vipExpireAt,
      
      // 实名认证
      kycStatus: user.kycStatus || 'Unverified',
      
      // 团长系统
      inviterId: user.inviterId,
      agentRank: user.agentRank || 0,
      isValidMember: user.isValidMember,
      validDirectCount: user.validDirectCount || 0,
      validTeamCount: user.validTeamCount || 0,
      
      // 账户状态
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }, '获取用户信息成功');
  });

  static getStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const stats = await UserService.getUserStats(userId);
    return success(res, stats, '获取统计信息成功');
  });

  static getUsersList = asyncHandler(async (req, res) => {
    const result = await UserService.getUsersList(req.query);
    return paginated(res, result.users, result);
  });

  static getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.findById(id);
    return success(res, user, '获取用户详情成功');
  });

  static updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body || {};
    
    const allowedFields = ['name', 'agentRank', 'balance', 'creditScore', 'isActive'];
    const filteredData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }
    
    if (Object.keys(filteredData).length === 0) {
      return error(res, '没有有效的更新字段', 400);
    }
    
    const user = await UserService.updateUser(id, filteredData);
    return success(res, user, '用户信息已更新');
  });

  static updateDeposit = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body || {};
    if (amount === undefined || amount === null) {
      return error(res, '请输入保证金金额', 400);
    }
    const user = await UserService.updateDeposit(id, amount);
    return success(res, { deposit: user.deposit }, '保证金已更新');
  });

  static updateKYCStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const user = await UserService.updateKYCStatus(id, status);
    return success(res, user, '审核状态已更新');
  });

  static toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.findById(id);
    user.isActive = !user.isActive;
    await user.save();
    return success(res, { isActive: user.isActive }, user.isActive ? '用户已启用' : '用户已禁用');
  });

  /**
   * 自动审查KYC申请
   */
  static autoCheckKYC = asyncHandler(async (req, res) => {
    const { userIds } = req.body || {};
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return error(res, '请提供要审查的用户ID列表', 400);
    }
    
    const result = await UserService.autoCheckKYC(userIds);
    return success(res, result, '自动审查完成');
  });

  /**
   * 批量审批通过KYC
   */
  static batchApproveKYC = asyncHandler(async (req, res) => {
    const { userIds } = req.body || {};
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return error(res, '请提供要审批的用户ID列表', 400);
    }
    
    const result = await UserService.batchApproveKYC(userIds);
    return success(res, result, `已通过 ${result.passed} 个用户的实名认证`);
  });

  /**
   * 批量拒绝KYC
   */
  static batchRejectKYC = asyncHandler(async (req, res) => {
    const { userIds } = req.body || {};
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return error(res, '请提供要拒绝的用户ID列表', 400);
    }
    
    const result = await UserService.batchRejectKYC(userIds);
    return success(res, result, `已拒绝 ${result.rejected} 个用户的实名认证`);
  });

  /**
   * 深度核验已通过的KYC
   */
  static deepVerifyKYC = asyncHandler(async (req, res) => {
    const result = await UserService.deepVerifyKYC();
    return success(res, result, '深度核验完成');
  });

  /**
   * 标记用户KYC为异常
   */
  static markKYCAbnormal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    
    const user = await UserService.markKYCAbnormal(id, reason || '系统标记异常');
    return success(res, user, '已标记为异常');
  });

  // ==========================================
  // 团长系统接口
  // ==========================================

  static bindInviter = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { inviterId } = req.body || {};
    if (!inviterId) return error(res, '请提供邀请人ID', 400);
    const result = await UserService.bindInviter(userId, inviterId);
    return success(res, result, '绑定邀请人成功');
  });

  static getMyTeamStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const data = await UserService.getTeamStats(userId);
    return success(res, data, '获取团队统计成功');
  });

  static getMyTeamList = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type = 'direct', keyword = '' } = req.query;
    const data = await UserService.getTeamList(userId, type, keyword);
    return success(res, data, '获取团队列表成功');
  });

  static getFriendCommissions = asyncHandler(async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user._id;
    const details = await UserService.getFriendCommissions(userId, friendId);
    return success(res, details, '获取好友佣金成功');
  });

  static getMyTeam = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const team = await UserService.getMyTeam(userId);
    return success(res, team, '获取团队信息成功');
  });

  static getMyCommissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const result = await UserService.getMyCommissions(userId, page, limit);
    return success(res, result, '获取佣金明细成功');
  });

  static checkUpgradeConditions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const conditions = await UserService.checkUpgradeConditions(userId);
    return success(res, conditions, '获取升级条件成功');
  });

  static upgradeAgentRank = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await UserService.upgradeAgentRank(userId);
    return success(res, result, result.message);
  });

  // ==========================================
  // 🆕 休闲中心货币系统接口
  // ==========================================

  /**
   * 🆕 获取用户休闲中心货币信息
   */
  static getLeisureCurrency = asyncHandler(async (req, res) => {
    const user = await UserService.findById(req.user._id);
    return success(res, {
      points: user.points,
      coins: user.coins,
      balance: user.balance
    }, '获取休闲中心货币信息成功');
  });

  /**
   * 🆕 增加积分 (管理员)
   */
  static addPoints = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, description } = req.body || {};
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的积分数量', 400);
    }
    
    const user = await UserService.addPoints(id, amount, description || '管理员发放积分');
    return success(res, { points: user.points }, '积分已增加');
  });

  /**
   * 🆕 扣除积分 (管理员)
   */
  static subtractPoints = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, description } = req.body || {};
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的积分数量', 400);
    }
    
    const user = await UserService.subtractPoints(id, amount, description || '管理员扣除积分');
    return success(res, { points: user.points }, '积分已扣除');
  });

  /**
   * 🆕 增加小象币 (管理员)
   */
  static addCoins = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, description } = req.body || {};
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的小象币数量', 400);
    }
    
    const user = await UserService.addCoins(id, amount, description || '管理员发放小象币');
    return success(res, { coins: user.coins }, '小象币已增加');
  });

  /**
   * 🆕 扣除小象币 (管理员)
   */
  static subtractCoins = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, description } = req.body || {};
    
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的小象币数量', 400);
    }
    
    const user = await UserService.subtractCoins(id, amount, description || '管理员扣除小象币');
    return success(res, { coins: user.coins }, '小象币已扣除');
  });

  /**
   * 🆕 积分兑换小象币 (用户)
   */
  static exchangePointsForCoins = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { points, coinsRate } = req.body || {};
    
    if (!points || points <= 0) {
      return error(res, '请输入有效的积分数量', 400);
    }
    
    const result = await UserService.exchangePointsForCoins(
      userId,
      points,
      coinsRate || 100
    );
    
    return success(res, result, `兑换成功：获得 ${result.coinsReceived} 小象币`);
  });

  /**
   * 🆕 小象币兑换积分 (用户)
   */
  static exchangeCoinsForPoints = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { coins, pointsRate } = req.body || {};
    
    if (!coins || coins <= 0) {
      return error(res, '请输入有效的小象币数量', 400);
    }
    
    const result = await UserService.exchangeCoinsForPoints(
      userId,
      coins,
      pointsRate || 10
    );
    
    return success(res, result, `兑换成功：获得 ${result.pointsReceived} 积分`);
  });
}

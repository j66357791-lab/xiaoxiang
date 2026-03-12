// user.controller.js
import { success, error, paginated } from '../../common/utils/response.js';
import { UserService } from '../users/user.service/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
// 🆕 引入 User 模型以便直接操作数据库
import User from './user.model.js';
import axios from 'axios';

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
      avatarColor: user.avatarColor || 'blue', // 🆕 返回头像颜色
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

  /**
   * 🆕 重新核验KYC（再次调用第三方API）
   */
  static reverifyKYC = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
      return error(res, '用户ID不能为空', 400);
    }
    const result = await UserService.reverifyKYC(id);
    return success(res, {
      id: result.user._id,
      kycStatus: result.user.kycStatus,
      verified: result.verified,
      reason: result.reason,
      abnormalReason: result.user.abnormalReason
    }, result.verified ? '核验通过' : '核验失败');
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
   * 🆕 游戏积分同步接口（关键修复）
   * 前端游戏开始/结束时调用此接口同步积分
   */
  static updatePoints = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { amount, type, description } = req.body || {};

    // 验证参数
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return error(res, '积分数量必须大于0', 400);
    }
    if (!type || !['add', 'subtract'].includes(type)) {
      return error(res, '类型必须是 add 或 subtract', 400);
    }

    let user;
    if (type === 'subtract') {
      user = await UserService.subtractPoints(userId, amount, description || '游戏消费');
    } else {
      user = await UserService.addPoints(userId, amount, description || '游戏收益');
    }

    return success(res, {
      points: user.points,
      balance: user.balance
    }, '积分更新成功');
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

  // ==========================================
  // 🆕 小象币转增功能
  // ==========================================
  /**
   * 🆕 根据用户ID查询用户基本信息（用于转增确认）
   */
  static getUserByIdForTransfer = asyncHandler(async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return error(res, '请提供用户ID', 400);
    }
    const user = await UserService.findById(userId);
    if (!user) {
      return error(res, '用户不存在', 404);
    }
    // 只返回基本信息，不暴露敏感数据
    return success(res, {
      id: user._id,
      name: user.name || '小象用户',
      email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // 邮箱脱敏
    }, '查询成功');
  });

  /**
   * 🆕 验证登录密码
   */
  static verifyPassword = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { password } = req.body || {};
    if (!password) {
      return error(res, '请输入密码', 400);
    }
    const user = await UserService.findById(userId);
    if (!user) {
      return error(res, '用户不存在', 404);
    }
    const isValid = user.comparePassword(password);
    if (!isValid) {
      return error(res, '密码错误', 400);
    }
    return success(res, { verified: true }, '密码验证成功');
  });

  /**
   * 🆕 小象币转增
   */
  static transferCoins = asyncHandler(async (req, res) => {
    const senderId = req.user._id;
    const { receiverId, amount, password } = req.body || {};

    // 参数验证
    if (!receiverId) {
      return error(res, '请输入接收方用户ID', 400);
    }
    if (!amount || amount <= 0) {
      return error(res, '请输入有效的转增数量', 400);
    }
    if (!password) {
      return error(res, '请输入登录密码', 400);
    }
    if (receiverId === senderId.toString()) {
      return error(res, '不能转增给自己', 400);
    }

    const result = await UserService.transferCoins(senderId, receiverId, amount, password);
    return success(res, result, '转增成功');
  });

  /**
   * 🆕 获取转增流水记录
   */
  static getTransferHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const result = await UserService.getTransferHistory(userId, type, page, limit);
    return success(res, result, '获取转增流水成功');
  });

  // ==========================================
  // 🆕 用户个人资料修改 (含AI审核)
  // ==========================================
  /**
   * 修改个人资料（昵称、头像）
   * 包含本地敏感词 + 智谱内容安全 API 自动审核
   */
  static updateMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { name, avatarColor } = req.body;

    if (!name && !avatarColor) {
      return error(res, '请提供要修改的昵称或头像颜色', 400);
    }

    const updateData = {};

    // 处理昵称
    if (name) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 12) {
        return error(res, '昵称长度需在2-12个字符之间', 400);
      }

      // 1. 本地敏感词黑名单（你可以自己扩展）
      const blacklist = [
        '傻逼',
        '操',
        '尼玛',
        '傻逼',
        '管理员',
        '官方',
        '客服',
        '诈骗',
        'fuck',
        'shit',
        '色情',
        '赌博',
        '毒品',
        '法轮功',
        '反动'
      ];
      const lowerName = trimmedName.toLowerCase();
      for (const word of blacklist) {
        if (lowerName.includes(word.toLowerCase())) {
          return error(res, '昵称包含敏感或违规词汇，请修改', 400);
        }
      }

      // 2. 调用智谱内容安全 API（可选，但推荐）
      const isSafe = await UserController.checkNicknameSafetyByZhipu(trimmedName);
      if (!isSafe.safe) {
        return error(res, isSafe.reason || '昵称内容不合规，请修改', 400);
      }

      updateData.name = trimmedName;
    }

    // 处理头像颜色
    if (avatarColor) {
      const allowedColors = ['pink', 'green', 'blue']; // 根据你前端 edit.js 的 avatars 定义
      if (!allowedColors.includes(avatarColor)) {
        return error(res, '无效的头像颜色选项', 400);
      }
      updateData.avatarColor = avatarColor;
    }

    // 执行更新
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    return success(res, {
      name: user.name,
      avatarColor: user.avatarColor
    }, '资料修改成功');
  });

  /**
   * 调用智谱内容安全 API 审核昵称
   * 返回 { safe: boolean, reason?: string }
   */
  static async checkNicknameSafetyByZhipu(text) {
    const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;

    // 如果没配置 key，就只依赖本地词库
    if (!ZHIPU_API_KEY) {
      console.warn('未配置 ZHIPU_API_KEY，跳过智谱内容安全审核');
      return { safe: true };
    }

    try {
      const response = await axios.post(
        'https://open.bigmodel.cn/api/paas/v4/moderations',
        {
          model: 'moderation',
          input: text,   // 用户填的昵称
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ZHIPU_API_KEY}`,
          },
        }
      );

      const result = response.data?.result_list?.[0];

      if (!result) {
        // 结构异常，保守起见拒绝
        return { safe: false, reason: '审核服务异常，请稍后再试' };
      }

      // risk_level: PASS / REVIEW / REJECT
      if (result.risk_level === 'REJECT') {
        return { safe: false, reason: '昵称内容违规，请修改' };
      }

      if (result.risk_level === 'REVIEW') {
        // 可疑内容，直接拒绝或人工审核，这里直接拒绝
        return { safe: false, reason: '昵称内容疑似违规，请修改' };
      }

      return { safe: true };
    } catch (err) {
      console.error('智谱内容安全 API 调用失败:', err.message);
      // 接口挂了，可以选择：
      // - 保守：拒绝保存
      // - 激进：允许通过（但依赖本地词库）
      return { safe: false, reason: '审核服务暂时不可用，请稍后再试' };
    }
  }
}

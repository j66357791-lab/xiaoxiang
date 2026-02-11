import { success, error, paginated } from '../../common/utils/response.js';
import { UserService } from './user.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { NotFoundError } from '../../common/utils/error.js';
import User from './user.model.js'; // 👈 补充引入
import Transaction from '../transactions/transaction.model.js'; // 👈 补充引入

/**
 * 用户控制器
 * 处理用户相关的 HTTP 请求和响应
 */
export class UserController {
  /**
   * 获取当前登录用户信息
   */
  static getMe = asyncHandler(async (req, res) => {
    return success(res, req.user, '获取用户信息成功');
  });

  /**
   * 获取用户统计信息
   */
  static getStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const stats = await UserService.getUserStats(userId);
    return success(res, stats, '获取统计信息成功');
  });

  /**
   * 获取用户列表（管理员）
   */
  static getUsersList = asyncHandler(async (req, res) => {
    const result = await UserService.getUsersList(req.query);
    return paginated(res, result.users, result);
  });

  /**
   * 获取单个用户详情（管理员）
   */
  static getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.findById(id);
    return success(res, user, '获取用户详情成功');
  });

  /**
   * 更新用户保证金（管理员）
   */
  static updateDeposit = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined || amount === null) {
      return error(res, '请输入保证金金额', 400);
    }

    const user = await UserService.updateDeposit(id, amount);
    return success(res, { deposit: user.deposit }, '保证金已更新');
  });

  /**
   * 更新 KYC 审核状态（管理员）
   */
  static updateKYCStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const user = await UserService.updateKYCStatus(id, status);
    return success(res, user, '审核状态已更新');
  });

  /**
   * 禁用/启用用户（管理员）
   */
  static toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await UserService.findById(id);

    user.isActive = !user.isActive;
    await user.save();

    return success(res, { isActive: user.isActive }, user.isActive ? '用户已启用' : '用户已禁用');
  });

  // =====================
  // 团长/邀请系统 (新增)
  // =====================

  /**
   * 绑定邀请人
   */
  static bindInviter = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { inviterId } = req.body;

    if (!inviterId) {
      return error(res, '请提供邀请人ID', 400);
    }

    const result = await UserService.bindInviter(userId, inviterId);
    return success(res, result, '绑定邀请人成功');
  });

  /**
   * 获取我的团队信息
   */
  static getMyTeam = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const team = await UserService.getMyTeam(userId);
    return success(res, team, '获取团队信息成功');
  });

  /**
   * 获取我的佣金明细
   */
  static getMyCommissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const result = await UserService.getMyCommissions(userId, page, limit);
    return success(res, result, '获取佣金明细成功');
  });

  /**
   * 检查升级条件
   */
  static checkUpgradeConditions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const conditions = await UserService.checkUpgradeConditions(userId);
    return success(res, conditions, '获取升级条件成功');
  });

  /**
   * 获取团队统计数据 (每日/每周/每月/总收益)
   */
  static getMyTeamStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // 1. 获取该用户的所有佣金记录
    const commissions = await Transaction.find({
      userId: userId,
      type: 'commission'
    }).sort({ createdAt: -1 });

    let total = 0;
    let daily = 0;
    let weekly = 0;
    let monthly = 0;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // 周日作为第一天
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    commissions.forEach(t => {
      const amount = t.amount || 0;
      const date = t.createdAt;

      total += amount;
      if (date >= startOfDay) daily += amount;
      if (date >= startOfWeek) weekly += amount;
      if (date >= startOfMonth) monthly += amount;
    });

    // 2. 获取直推人数
    const directCount = await User.countDocuments({ inviterId: userId });
    
    // 3. 获取间推人数 (先找直推的ID，再找他们推的人)
    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);
    const indirectCount = await User.countDocuments({ inviterId: { $in: directIds } });

    const data = {
      totalIncome: total,
      dailyIncome: daily,
      weeklyIncome: weekly,
      monthlyIncome: monthly,
      directCount,
      indirectCount
    };

    return success(res, data, '获取团队统计成功');
  });

  /**
   * 获取团队列表 (支持搜索和分类)
   */
  static getMyTeamList = asyncHandler(async (req, res) => {
    const { type = 'direct', keyword = '' } = req.query;
    const myId = req.user._id;
    let users = [];

    // 预处理：获取直推ID列表 (用于间推查询)
    const directUsers = await User.find({ inviterId: myId }).select('_id');
    const directIds = directUsers.map(u => u._id);

    if (type === 'direct') {
      // 直推
      users = await User.find({
        inviterId: myId,
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } }
        ]
      }).select('name email avatar createdAt balance isValidMember');
    } else {
      // 间推
      users = await User.find({
        inviterId: { $in: directIds },
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } }
        ]
      }).select('name email avatar createdAt balance isValidMember');
    }

    // 获取每个好友贡献的总佣金
    const usersWithCommission = await Promise.all(
      users.map(async (u) => {
        // 通过 description 匹配好友的邮箱来聚合计算佣金
        const totalCommission = await Transaction.aggregate([
          { 
            $match: { 
              userId: myId, 
              type: 'commission',
              description: { $regex: u.email, $options: 'i' }
            } 
          },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        return {
          ...u.toObject(),
          totalCommission: totalCommission[0] ? totalCommission[0].total : 0
        };
      })
    );

    return success(res, usersWithCommission, '获取团队列表成功');
  });

  /**
   * 获取某个好友的佣金明细
   */
  static getFriendCommissions = asyncHandler(async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user._id;

    // 1. 获取好友信息 (主要是为了拿到 email，因为 Transaction 里存的是 description)
    const friend = await User.findById(friendId).select('email');
    if (!friend) {
      return error(res, '用户不存在', 404);
    }

    // 2. 查找相关的佣金交易记录
    const details = await Transaction.find({
      userId: userId,
      type: 'commission',
      description: { $regex: friend.email, $options: 'i' } // 模糊匹配
    }).sort({ createdAt: -1 });

    return success(res, details, '获取好友佣金成功');
  });
}

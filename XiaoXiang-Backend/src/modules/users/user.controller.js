import { success, error, paginated } from '../../common/utils/response.js';
import { UserService } from './user.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { NotFoundError } from '../../common/utils/error.js';

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

  // 👇 新增：团长系统相关接口

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
}

/**
 * 获取团队统计数据 (每日/每周/每月/总收益)
 */
exports.getMyTeamStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 获取该用户的所有佣金记录
    const commissions = await Transaction.find({
      userId: userId,
      type: 'commission'
    }).sort({ createdAt: -1 });

    let total = 0;
    let daily = 0;
    let weekly = 0;
    let monthly = 0;

    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    commissions.forEach(t => {
      const amount = t.amount || 0;
      const date = t.createdAt;

      total += amount;
      if (date >= startOfDay) daily += amount;
      if (date >= startOfWeek) weekly += amount;
      if (date >= startOfMonth) monthly += amount;
    });

    // 获取直推和间推人数
    const directCount = await User.countDocuments({ inviterId: userId });
    
    // 获取直推用户ID列表
    const directUsers = await User.find({ inviterId: userId }).select('_id');
    const directIds = directUsers.map(u => u._id);
    const indirectCount = await User.countDocuments({ inviterId: { $in: directIds } });

    res.json({
      success: true,
      data: {
        totalIncome: total,
        dailyIncome: daily,
        weeklyIncome: weekly,
        monthlyIncome: monthly,
        directCount,
        indirectCount
      }
    });
  } catch (error) {
    console.error('获取团队统计失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
};

/**
 * 获取团队列表 (支持搜索和分类)
 */
exports.getMyTeamList = async (req, res) => {
  try {
    const { type = 'direct', keyword = '' } = req.query;
    const myId = req.user._id;

    let users = [];

    if (type === 'direct') {
      // 直推
      users = await User.find({
        inviterId: myId,
        $or: [
          { name: { $regex: keyword,$options: 'i' } },
          { email: { $regex: keyword,$options: 'i' } }
        ]
      }).select('name email avatar createdAt balance isValidMember');
    } else {
      // 间推：先找到直推的ID，再找他们推的人
      const directUsers = await User.find({ inviterId: myId }).select('_id');
      const directIds = directUsers.map(u => u._id);

      users = await User.find({
        inviterId: { $in: directIds },
        $or: [
          { name: { $regex: keyword,$options: 'i' } },
          { email: { $regex: keyword,$options: 'i' } }
        ]
      }).select('name email avatar createdAt balance isValidMember');
    }

    // 获取每个好友贡献的总佣金 (简化版：直接查数据库可能较慢，这里做个简单的累加)
    // 实际生产环境建议在 User 模型里冗余一个字段 `totalContribution`
    const usersWithCommission = await Promise.all(
      users.map(async (u) => {
        const totalCommission = await Transaction.aggregate([
          { $match: { userId: req.user._id, description: {$regex: u.email, $options: 'i' }, type: 'commission' } },
          { $group: { _id: null, total: {$sum: '$amount' } } }
        ]);
        return {
          ...u.toObject(),
          totalCommission: totalCommission[0] ? totalCommission[0].total : 0
        };
      })
    );

    res.json({ success: true, data: usersWithCommission });
  } catch (error) {
    console.error('获取团队列表失败:', error);
    res.status(500).json({ success: false, message: '获取列表失败' });
  }
};

/**
 * 获取某个好友的佣金明细
 */
exports.getFriendCommissions = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // 安全检查：确保该好友确实是你的下线 (可选)
    
    // 查找涉及该好友的佣金交易记录
    // 这里的逻辑是：description 里通常包含 "来自用户 xxx 的佣金" 或者关联字段
    // 简单起见，我们通过 description 模糊匹配，或者你需要修改 Transaction Schema 增加 refUserId
    // 假设 description 格式：`直推佣金收益` (没名字) -> 我们只能通过 User.email 反推，或者看之前的逻辑
    
    // 修正逻辑：直接根据 description 包含该用户标识来查找，或者如果是精准业务，需要在 Transaction 表加 `relatedUserId` 字段。
    // 这里为了演示，我们查找所有佣金，由前端过滤或者返回全部让前端展示。
    // 但最好的做法是：
    const transactions = await Transaction.find({
      userId: userId,
      type: 'commission',
      description: { $regex: friendId } // 假设我们改了逻辑让 description 包含 ID，或者直接查所有
    }).sort({ createdAt: -1 });

    // 注意：由于之前的设计可能没在 Transaction 里存 relatedUserId，
    // 实际上最准确的方法是：
    // User.findById(friendId) 拿到 email -> Transaction.find({ userId: me, description: new RegExp(email) })
    
    const friend = await User.findById(friendId).select('email');
    if (!friend) return res.status(404).json({ success: false, message: '用户不存在' });

    const details = await Transaction.find({
      userId: userId,
      type: 'commission',
      description: { $regex: friend.email } // 粗略匹配
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: details });
  } catch (error) {
    console.error('获取好友佣金失败:', error);
    res.status(500).json({ success: false, message: '获取详情失败' });
  }
};
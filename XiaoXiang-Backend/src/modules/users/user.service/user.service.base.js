/**
 * 用户服务 - 基础模块
 * 包含：用户查找、注册、登录等基础方法
 */
import User from '../user.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';

export class UserServiceBase {
  /**
   * 根据 ID 查找用户
   */
  static async findById(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    return user;
  }

  /**
   * 根据 Email 查找用户
   */
  static async findByEmail(email) {
    const user = await User.findOne({ email });
    return user;
  }

  /**
   * 注册用户
   */
  static async register(email, password) {
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new ConflictError('该邮箱已被注册');

    const user = await User.create({ email, password });
    return user;
  }

  /**
   * 登录验证
   */
  static async login(email, password) {
    const user = await User.findOne({ email, isActive: true });
    if (!user) throw new BadRequestError('邮箱或密码错误');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new BadRequestError('邮箱或密码错误');

    await user.updateLastLogin();
    return user;
  }

  /**
   * 获取用户列表（管理员）
   */
  static async getUsersList(query = {}) {
    const { search, page = 1, limit = 100 } = query;

    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { realName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    return { users, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 管理员更新用户信息
   */
  static async updateUser(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    const allowedFields = ['name', 'agentRank', 'balance', 'creditScore', 'isActive'];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'agentRank') {
          const rank = Number(updateData[field]);
          if (isNaN(rank) || rank < 1 || rank > 5) {
            throw new BadRequestError('团长等级必须在 1-5 之间');
          }
          user[field] = rank;
        } else if (field === 'balance') {
          const balance = Number(updateData[field]);
          if (isNaN(balance) || balance < 0) {
            throw new BadRequestError('余额不能为负数');
          }
          user[field] = balance;
        } else if (field === 'creditScore') {
          const score = Number(updateData[field]);
          if (isNaN(score) || score < -999 || score > 100) {
            throw new BadRequestError('信誉分必须在 -999 到 100 之间');
          }
          user[field] = score;
        } else {
          user[field] = updateData[field];
        }
      }
    }
    
    await user.save();
    clearCache('/api/users/profile');
    console.log(`[UserService] 用户 ${userId} 信息已更新:`, updateData);
    return user;
  }

  /**
   * 切换用户状态
   */
  static async toggleUserStatus(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    user.isActive = !user.isActive;
    await user.save();
    clearCache('/api/users/profile');
    return { isActive: user.isActive };
  }

  /**
   * 更新用户保证金
   */
  static async updateDeposit(userId, amount) {
    if (amount < 0) throw new BadRequestError('保证金不能为负数');

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    user.deposit = Number(amount);
    await user.save();
    clearCache('/api/users/profile');
    return user;
  }
}

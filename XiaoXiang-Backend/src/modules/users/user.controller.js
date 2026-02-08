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
}

import { UserService } from '../users/user.service.js';
import { generateToken } from '../../common/middlewares/auth.js';
import { BadRequestError, ConflictError } from '../../common/utils/error.js';

/**
 * 认证服务层
 */
export class AuthService {
  /**
   * 用户注册
   */
  static async register(email, password) {
    // 检查邮箱是否已注册
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('该邮箱已被注册');
    }

    // 创建用户
    const user = await UserService.register(email, password);

    // 生成 Token
    const token = generateToken(user._id);

    return { user, token };
  }

  /**
   * 用户登录
   */
  static async login(email, password) {
    // 验证用户
    const user = await UserService.login(email, password);

    // 生成 Token
    const token = generateToken(user._id);

    return { user, token };
  }

  /**
   * 提交实名认证
   */
  static async submitKYC(userId, idCard, idCardFront, idCardBack) {
    return await UserService.submitKYC(userId, idCard, idCardFront, idCardBack);
  }
}

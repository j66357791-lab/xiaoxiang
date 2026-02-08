import { success } from '../../common/utils/response.js';
import { AuthService } from './auth.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

/**
 * 认证控制器
 */
export class AuthController {
  /**
   * 注册
   */
  static register = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, token } = await AuthService.register(email, password);

    return success(res, {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        balance: user.balance,
        points: user.points
      },
      token
    }, '注册成功', 201);
  });

  /**
   * 登录
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, token } = await AuthService.login(email, password);

    return success(res, {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        balance: user.balance,
        points: user.points,
        lastLogin: user.lastLogin
      },
      token
    }, '登录成功');
  });
}

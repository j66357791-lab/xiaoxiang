import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/error.js';
import User from '../../modules/users/user.model.js';

/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer Token，并将用户信息挂载到 req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // 获取 Token
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('请提供有效的访问令牌');
    }

    const token = authHeader.replace('Bearer ', '');

    // 验证 Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // 查询用户
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      throw new UnauthorizedError('用户不存在');
    }

    // 检查用户状态
    if (!user.isActive) {
      throw new UnauthorizedError('用户已被禁用');
    }

    // 将用户信息挂载到请求对象
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('令牌无效'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('令牌已过期'));
    }
    next(err);
  }
};

/**
 * 角色权限验证中间件
 * 验证用户是否具有指定角色
 * @param {...string} roles - 允许的角色列表
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('未登录'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('权限不足'));
    }

    next();
  };
};

/**
 * 生成 JWT Token
 * @param {string} userId - 用户 ID
 * @param {string} expiresIn - 过期时间，默认 30 天
 * @returns {string} - JWT Token
 */
export const generateToken = (userId, expiresIn = '30d') => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn }
  );
};

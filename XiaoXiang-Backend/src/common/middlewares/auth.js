import jwt from 'jsonwebtoken';
// 引入 User 模型作为双重保险（虽然通常不需要，但为了您的安心保留）
import User from '../../modules/users/user.model.js'; 
import { error } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET || 'xiaoxiang_secret_key_2024';

// 认证中间件
export const authenticate = async (req, res, next) => {
  try {
    let token;
    
    // 1. 获取 Token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return error(res, '未授权，请登录', 401);
    }

    // 2. 验证 Token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. 挂载用户信息
    // 优先使用 Token 中的信息
    req.user = {
      _id: decoded.id || decoded._id,
      name: decoded.name,
      role: decoded.role // 直接从 Token 获取角色
    };
    
    // ✅ 双重保险：如果 Token 中没有 role (旧版 Token 可能情况)，则查数据库
    if (!req.user.role && req.user._id) {
       const dbUser = await User.findById(req.user._id);
       if (dbUser) {
         req.user.role = dbUser.role;
         req.user.name = dbUser.name;
       }
    }

    next();
  } catch (err) {
    console.error('Auth Error:', err);
    return error(res, 'Token无效或已过期', 401);
  }
};

// 权限检查中间件
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, '未授权', 401);
    }

    // ✅ 核心修复：超级管理员直接放行
    // 无论 Token 还是数据库查出来的，只要是 superAdmin，就拥有所有权限
    if (req.user.role === 'superAdmin') {
      return next();
    }

    // 检查用户角色是否在允许的角色列表中
    if (!roles.includes(req.user.role)) {
      return error(res, '权限不足', 403);
    }
    next();
  };
};

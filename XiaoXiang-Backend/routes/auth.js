import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../model/User.js';

const router = express.Router();

// JWT 令牌生成函数
const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET || 'your-secret-key', 
    { expiresIn: '30d' }
  );
};

// 注册接口
router.post('/register', async (req, res) => {
  console.log('========================================');
  console.log('[Auth] 收到注册请求');
  console.log('[Auth] 邮箱:', req.body.email);
  
  try {
    const { email, password } = req.body;

    // 验证输入
    if (!email || !password) {
      console.log('[Auth] 错误: 邮箱或密码为空');
      return res.status(400).json({
        success: false,
        message: '邮箱和密码不能为空'
      });
    }

    // 检查用户是否已存在
    console.log('[Auth] 正在检查用户是否存在...');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('[Auth] 错误: 邮箱已存在');
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // 创建新用户
    console.log('[Auth] 正在创建新用户...');
    const user = new User({ email, password });
    
    console.log('[Auth] 正在保存到数据库...');
    await user.save();
    console.log('[Auth] 用户保存成功! ID:', user._id);

    // 生成令牌
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          balance: user.balance,
          points: user.points
        },
        token
      }
    });

  } catch (error) {
    console.error('[Auth] 注册过程发生错误:');
    console.error('   - 错误名称:', error.name);
    console.error('   - 错误代码:', error.code);
    console.error('   - 错误信息:', error.message);
    
    // 捕获 MongoDB 重复键错误（并发注册时可能发生）
    if (error.code === 11000) {
      console.error('[Auth] 捕获到重复键错误 (E11000)');
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // Mongoose 验证错误
    if (error.name === 'ValidationError') {
      console.error('[Auth] 捕获到验证错误');
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    // 未知服务器错误
    console.error('[Auth] 未知服务器错误，返回 500');
    res.status(500).json({
      success: false,
      message: '服务器错误，请稍后重试'
    });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
  console.log('========================================');
  console.log('[Auth] 收到登录请求');
  
  try {
    const { email, password } = req.body;

    // 验证输入
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱和密码不能为空'
      });
    }

    // 查找用户
    console.log('[Auth] 正在查找用户...');
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      console.log('[Auth] 登录失败: 用户不存在或已禁用');
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 验证密码
    console.log('[Auth] 正在验证密码...');
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('[Auth] 登录失败: 密码错误');
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 更新最后登录时间
    try {
      await user.updateLastLogin();
    } catch (err) {
      console.warn('[Auth] 更新登录时间失败 (不影响登录流程):', err.message);
    }

    // 生成令牌
    const token = generateToken(user._id);
    console.log('[Auth] 登录成功!');

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          balance: user.balance,
          points: user.points,
          lastLogin: user.lastLogin
        },
        token
      }
    });

  } catch (error) {
    console.error('[Auth] 登录过程发生错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，请稍后重试'
    });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          balance: user.balance,
          points: user.points,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: '令牌无效'
    });
  }
});

export default router;

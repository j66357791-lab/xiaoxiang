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
  try {
    const { email, password } = req.body;

    // 验证输入
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱和密码不能为空'
      });
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // 创建新用户
    const user = new User({ email, password });
    await user.save();

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
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: '服务器错误，请稍后重试'
    });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
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
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 更新最后登录时间
    await user.updateLastLogin();

    // 生成令牌
    const token = generateToken(user._id);

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
    console.error('登录错误:', error);
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
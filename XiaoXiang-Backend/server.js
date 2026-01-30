import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';

// ===============================
// 1. 修正：引入数据库模型 (注意：现在是 ./model/ 单数)
// ===============================
import './model/User.js';
import './model/Category.js';
import './model/Job.js';
import './model/Order.js';
import './model/TaskType.js'; 

// ===============================
// 导入路由区域
// ===============================
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import jobRoutes from './routes/jobs.js';
import orderRoutes from './routes/orders.js';

// ===============================
// 初始化应用和配置
// ===============================
const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('='.repeat(60));
console.log('🚀🚀 小象兼职后端服务器启动中...');
console.log(`📍 环境: ${NODE_ENV}`);
console.log(`📍 端口: ${PORT}`);
console.log('='.repeat(60));

// ===============================
// 自定义日志中间件
// ===============================
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
  
  res.on('finish', () => {
    console.log(`[${timestamp}] ${method} ${url} - 状态: ${res.statusCode} - IP: ${ip}`);
  });
  
  next();
};

// ===============================
// 中间件配置区域
// ===============================
console.log('\n📦📦 配置中间件...');

// 日志中间件
app.use(logger);

// CORS 配置
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 文件上传配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

console.log('✅ 中间件配置完成');

// ===============================
// 健康检查路由区域
// ===============================
console.log('\n🏥🏥 设置健康检查路由...');

// 根路径健康检查
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: '小象兼职后端 API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// API 健康检查
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  let dbStatusText = 'unknown';
  
  switch(dbStatus) {
    case 0: dbStatusText = 'disconnected'; break;
    case 1: dbStatusText = 'connected'; break;
    case 2: dbStatusText = 'connecting'; break;
    case 3: dbStatusText = 'disconnecting'; break;
  }
  
  res.json({ 
    status: 'OK', 
    database: dbStatusText,
    uptime: process.uptime(),
    memory: {
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    },
    timestamp: new Date().toISOString()
  });
});

console.log('✅ 健康检查路由设置完成');

// ===============================
// 数据库连接区域
// ===============================
console.log('\n🗄🗄️  初始化数据库连接...');

const connectDB = async () => {
  try {
    // 👇 修正点：使用 || 语法，并移除了硬编码的赋值错误
    // 它会优先读取 .env 文件的值，如果没读到，再尝试后面的链接
    const mongoUri = process.env.MONGODB_URI ||
                    process.env.MONGO_URL ||
                    "mongodb+srv://j66357791_db_user:hjh628727@cluster0.oiwbvje.mongodb.net/invest-v5?retryWrites=true&w=majority" || 
                    'mongodb://localhost:27017/xiaoxiang';
    
    console.log('🔗🔗 数据库连接信息:');
    console.log(`   - 环境: ${NODE_ENV}`);
    console.log(`   - URI: ${mongoUri.includes('@') ? 
      mongoUri.split('@')[0] + '@***隐藏密码***' + mongoUri.split('@')[1] : 
      '本地数据库'}`);
    
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };
    
    console.log('⏳⏳⏳ 正在连接数据库...');
    const startTime = Date.now();
    
    await mongoose.connect(mongoUri, options);
    const endTime = Date.now();
    
    console.log(`✅ 数据库连接成功 (${endTime - startTime}ms)`);
    console.log(`   - 数据库名称: ${mongoose.connection.db?.databaseName || '未知'}`);
    console.log(`   - 主机: ${mongoose.connection.host || '未知'}`);
    console.log(`   - 端口: ${mongoose.connection.port || '未知'}`);
    
  } catch (error) {
    console.error('❌❌ 数据库连接失败:');
    console.error(`   - 错误: ${error.name}`);
    console.error(`   - 消息: ${error.message}`);
    
    if (error.name === 'MongoServerError' && error.code === 8000) {
      console.error('   🔐🔐 认证失败：请检查数据库用户名和密码');
    } else if (error.name === 'MongoNetworkError') {
      console.error('   🌐🌐 网络错误：请检查数据库服务器是否可访问');
    }
    
    process.exit(1);
  }
};

// ===============================
// API 路由区域
// ===============================
console.log('\n🛣🛣🛣️  注册API路由...');

// 业务路由 - 认证
app.use('/api/auth', authRoutes);
console.log('   ✅ 认证路由: /api/auth');

// 业务路由 - 管理员
app.use('/api/admin', adminRoutes);
console.log('   ✅ 管理员路由: /api/admin');

// 业务路由 - 兼职大厅
app.use('/api/jobs', jobRoutes);
console.log('   ✅ 兼职任务路由: /api/jobs');

// 业务路由 - 订单列表
app.use('/api/orders', orderRoutes);
console.log('   ✅ 订单路由: /api/orders');

console.log('✅ API路由注册完成');

// ===============================
// 文件上传路由
// ===============================
app.post('/api/admin/job', upload.array('contentImages'), adminRoutes);

// ===============================
// Expo 测试接口区域
// ===============================
console.log('\n📱📱 注册 Expo 测试接口...');

// Expo 连接测试接口
app.get('/api/expo/test', (req, res) => {
  res.json({
    success: true,
    message: 'Expo 应用连接测试成功',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    features: {
      authentication: true,
      database: mongoose.connection.readyState === 1,
      api: 'v1.0'
    }
  });
});

// 模拟用户数据接口（用于 Expo 测试）
app.get('/api/expo/demo/users', (req, res) => {
  res.json({
    success: true,
    data: {
      users: [
        {
          id: 1,
          email: 'demo@xiaoxiang.com',
          role: 'user',
          balance: 100.50,
          points: 500,
          joinDate: '2024-01-01'
        },
        {
          id: 2,
          email: 'admin@xiaoxiang.com', 
          role: 'admin',
          balance: 1000.00,
          points: 2500,
          joinDate: '2024-01-15'
        }
      ]
    }
  });
});

// Expo 健康检查（简化版）
app.get('/api/expo/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'xiaoxiang-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

console.log('✅ Expo 测试接口注册完成');

// ===============================
// 错误处理区域
// ===============================
console.log('\n🛡🛡🛡️  设置错误处理中间件...');

// 404 处理
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API 路由不存在',
    path: req.originalUrl,
    method: req.method
  });
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
  console.error('💥💥 服务器错误:');
  console.error(`   路径: ${req.method} ${req.url}`);
  console.error(`   错误: ${error.name}`);
  console.error(`   消息: ${error.message}`);
  
  if (error.stack && NODE_ENV === 'development') {
    console.error('   堆栈:');
    console.error(error.stack.split('\n').slice(0, 5).join('\n'));
  }
  
  // Mongoose 验证错误
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: Object.values(error.errors).map(e => e.message)
    });
  }
  
  // MongoDB 重复键错误
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} 已存在`
    });
  }
  
  // JWT 错误
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '无效的令牌'
    });
  }
  
  // 默认错误响应
  res.status(error.status || 500).json({
    success: false,
    message: NODE_ENV === 'production' 
      ? '服务器内部错误，请稍后重试' 
      : error.message,
    ...(NODE_ENV === 'development' && { stack: error.stack })
  });
});

console.log('✅ 错误处理中间件设置完成');

// ===============================
// 进程信号处理区域
// ===============================
console.log('\n🔧🔧 设置进程信号处理...');

// 优雅关闭处理
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  收到 ${signal} 信号，正在关闭服务器...`);
  
  try {
    // 关闭数据库连接
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ 数据库连接已关闭');
    }
    
    console.log('👋👋 服务器优雅关闭完成');
    process.exit(0);
  } catch (error) {
    console.error('❌❌ 关闭过程中发生错误:', error);
    process.exit(1);
  }
};

// 注册信号处理
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon 重启

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('💥💥 未捕获的异常:', error);
  process.exit(1);
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥💥 未处理的 Promise 拒绝:');
  console.error('   原因:', reason);
});

console.log('✅ 进程信号处理设置完成');

// ===============================
// 服务器启动区域
// ===============================
const startServer = async () => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀🚀 启动服务器...');
    console.log('='.repeat(60));
    
    // 连接数据库
    await connectDB();
    
    // 启动 HTTP 服务器
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉🎉 服务器启动成功!');
      console.log('='.repeat(60));
      console.log(`📍 服务器信息:`);
      console.log(`   - 环境: ${NODE_ENV}`);
      console.log(`   - 地址: http://localhost:${PORT}`);
      console.log(`   - 时间: ${new Date().toISOString()}`);
      console.log(`   - PID: ${process.pid}`);
      console.log('='.repeat(60));
      console.log('\n🔗🔗 可用端点:');
      console.log(`   🌐🌐 主页: http://localhost:${PORT}/`);
      console.log(`   🏥🏥🏥 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`   🔐🔐 认证接口: http://localhost:${PORT}/api/auth`);
      console.log(`   👮‍♂️👮‍♂️ 管理员接口: http://localhost:${PORT}/api/admin`);
      console.log(`   💼💼 兼职接口: http://localhost:${PORT}/api/jobs`);
      console.log(`   📱📱 Expo 测试: http://localhost:${PORT}/api/expo/test`);
      console.log('='.repeat(60));
      console.log('\n📋📋 使用说明:');
      console.log('   - 按 Ctrl+C 优雅关闭服务器');
      console.log('   - 使用 SIGTERM 信号进行平滑重启');
      console.log('   - 查看日志了解详细请求信息');
      console.log('='.repeat(60));
    });
    
    // 服务器错误处理
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌❌ 端口 ${PORT} 已被占用，请使用其他端口`);
      } else {
        console.error('❌❌ 服务器错误:', error);
      }
      process.exit(1);
    });
    
    return server;
    
  } catch (error) {
    console.error('💥💥 服务器启动失败:');
    console.error(error);
    process.exit(1);
  }
};

// ===============================
// 应用程序启动
// ===============================
startServer().catch((error) => {
  console.error('💥💥 应用程序启动失败:');
  console.error(error);
  process.exit(1);
});

export default app;

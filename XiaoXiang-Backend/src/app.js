// src/app.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { logger } from './common/middlewares/logger.js';
import { errorHandler, notFoundHandler } from './common/middlewares/error.js';
import { cacheMiddleware } from './common/middlewares/cache.js';

// ==================== 路由引入 ====================
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import jobRoutes from './modules/jobs/job.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import taskTypeRoutes from './modules/task-types/taskType.routes.js';
import paymentRoutes from './modules/payments/paymentMethod.routes.js';
import withdrawalRoutes from './modules/withdrawals/withdrawal.routes.js';
import transactionRoutes from './modules/transactions/transaction.routes.js';
import auditRoutes from './modules/audits/audit.routes.js';
import announcementRoutes from './modules/announcement/announcement.routes.js';
import versionRoutes from './modules/version/version.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import giftRoutes from './modules/gift/gift.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';
import { flipcardRoutes } from './modules/GameCenter/index.js';
import assetRoutes from './modules/asset/assetSnapshot.routes.js';
import inventorySnapshotRoutes from './modules/inventory/inventorySnapshot.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import warehouseRoutes from './modules/warehouses/warehouse.routes.js';
import helpPeopleRoutes from './modules/help-people/help-people.routes.js';

// 🆕 矿池路由和定时任务
import miningPoolRoutes from './modules/mining-pool/mining-pool.routes.js';
import { startMiningPoolJobs } from './modules/mining-pool/mining-pool.cron.js';

// 🆕 从游戏中心统一引入游戏相关路由
import { 
  gameStatsRoutes,
  wheelGameRoutes,
  mysteryShopRoutes,
  gamescaiquanRoutes,
} from './modules/GameCenter/index.js';

// 获取 __dirname (ES6 模块)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();

console.log('[App] 🚀 开始初始化 Express 应用...');
console.log(`[App] 📁 项目根目录: ${__dirname}`);
console.log(`[App] 🌐 Node版本: ${process.version}`);

// =====================
// 中间件配置
// =====================

console.log('[App] ⚙️  配置中间件...');

// 日志中间件
app.use(logger);

// CORS
const corsOptions = {
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
console.log(`[App] 🌍 CORS配置: ${JSON.stringify(corsOptions.origin)}`);

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
console.log('[App] 📦 请求体解析中间件已配置');

// ✅ 修改：静态文件服务 - 使用 Zeabur 挂载路径
const uploadsPath = '/app/uploads';
app.use('/uploads', express.static(uploadsPath));
console.log(`[App] 📂 静态文件路径: ${uploadsPath}`);

// =====================
// 健康检查
// =====================

console.log('[App] 🏥 配置健康检查端点...');

app.get('/', (req, res) => {
  console.log(`[App] 📍 主页被访问，IP: ${req.ip}`);
  res.json({
    status: 'OK',
    service: '小象兼职后端 API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  console.log(`[Health] 🔍 健康检查请求，数据库状态: ${dbStates[dbState]}`);
  
  const healthcheck = {
    status: 'OK',
    message: 'API 运行正常',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStates[dbState] || 'unknown',
      readyState: dbState
    },
    system: {
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    environment: process.env.NODE_ENV || 'development'
  };
  
  if (dbState !== 1) {
    healthcheck.status = 'WARNING';
    healthcheck.message = 'API运行正常，但数据库连接有问题';
    console.warn(`[Health] ⚠️  数据库连接异常: ${dbStates[dbState]}`);
  }
  
  res.json(healthcheck);
});

app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  console.log(`[DockerHealth] 🐳 Docker健康检查，数据库状态: ${dbState}`);
  
  if (dbState === 1) {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      service: 'xiaoxiang-backend'
    });
  } else {
    console.error(`[DockerHealth] ❌ 健康检查失败，数据库状态: ${dbState}`);
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: `Database connection state: ${dbState}`
    });
  }
});

app.get('/health-check', async (req, res) => {
  console.log(`[HealthCheck] 🩺 详细健康检查请求`);
  
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {}
  };
  
  try {
    const dbState = mongoose.connection.readyState;
    healthcheck.checks.database = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      readyState: dbState,
      description: dbState === 1 ? '数据库连接正常' : '数据库连接异常'
    };
    
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    healthcheck.checks.memory = {
      status: memoryPercentage < 90 ? 'healthy' : 'warning',
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      percentage: `${Math.round(memoryPercentage)}%`,
      description: memoryPercentage < 90 ? '内存使用正常' : '内存使用过高'
    };
    
    if (dbState !== 1) {
      healthcheck.message = 'Database connection issue';
      console.error(`[HealthCheck] ❌ 数据库连接异常: ${dbState}`);
      return res.status(503).json(healthcheck);
    }
    
    console.log(`[HealthCheck] ✅ 所有健康检查通过`);
    res.status(200).json(healthcheck);
    
  } catch (error) {
    console.error(`[HealthCheck] 💥 健康检查异常:`, error);
    healthcheck.message = error.message;
    healthcheck.error = error.stack;
    res.status(503).json(healthcheck);
  }
});

// =====================
// API 路由
// =====================

console.log('[App] 🛣️  配置API路由...');

import User from './modules/users/user.model.js';
app.set('User', User);

console.log('[App] 📡 注册认证路由: /api/auth');
app.use('/api/auth', authRoutes);

console.log('[App] 👤 注册用户路由: /api/users');
app.use('/api/users', cacheMiddleware(5), userRoutes);

console.log('[App] 📋 注册审核路由: /api/audits');
app.use('/api/audits', auditRoutes);

console.log('[App] 📋 注册任务路由: /api/jobs');
app.use('/api/jobs', cacheMiddleware(30), jobRoutes);

console.log('[App] 📦 注册订单路由: /api/orders');
app.use('/api/orders', orderRoutes);

console.log('[App] 🏷️  注册分类路由: /api/categories');
app.use('/api/categories', cacheMiddleware(60), categoryRoutes);
app.use('/api/admin/categories', categoryRoutes);

console.log('[App] 🔧 注册任务类型路由: /api/task-types');
app.use('/api/task-types', taskTypeRoutes);

console.log('[App] 💳 注册支付路由: /api/payments');
app.use('/api/payments', paymentRoutes);

console.log('[App] 💰 注册提现路由: /api/withdrawals');
app.use('/api/withdrawals', withdrawalRoutes);

console.log('[App] 📊 注册交易路由: /api/transactions');
app.use('/api/transactions', transactionRoutes);

console.log('[App] 📢 注册公告路由: /api/announcements');
app.use('/api/announcements', announcementRoutes);

console.log('[App] 📌 注册版本检查路由: /api/version');
app.use('/api/version', versionRoutes);

console.log('[App] 🔔 注册通知路由: /api/notifications');
app.use('/api/notifications', notificationRoutes);

console.log('[App] 📊 注册统计路由: /api/stats');
app.use('/api/stats', statsRoutes);

console.log('[App] 🎁 注册礼包路由: /api/gift');
app.use('/api/gift', giftRoutes);

app.use('/api/games/flipcard', flipcardRoutes);
app.use('/api/inventory', inventorySnapshotRoutes);

// ===================== 🎮 游戏中心路由 =====================
console.log('[App] 🎮 注册游戏统计路由: /api/game-stats');
app.use('/api/game-stats', gameStatsRoutes);

console.log('[App] 🎰 注册转盘游戏路由: /api/games/wheel5600');
app.use('/api/games/wheel5600', wheelGameRoutes);

console.log('[App] 🎁 注册神秘商店路由: /api/mystery-shop');
app.use('/api/mystery-shop', mysteryShopRoutes);

console.log('[App] ✊ 注册猜拳游戏路由: /api/gamescaiquan');
app.use('/api/gamescaiquan', gamescaiquanRoutes);

// ===================== ⛏️ 矿池路由 =====================
console.log('[App] ⛏️ 注册矿池路由: /api/mining-pool');
app.use('/api/mining-pool', miningPoolRoutes);

// ===================== 💰 资产路由 =====================
console.log('[App] 💰 注册资产路由: /api/assets');
app.use('/api/assets', assetRoutes);

// ===================== 📤 上传路由 =====================
console.log('[App] 📤 注册上传路由: /api/upload');
app.use('/api/upload', uploadRoutes);

// ===================== 🏭 仓库路由 =====================
console.log('[App] 🏭 注册仓库路由: /api/warehouses');
app.use('/api/warehouses', warehouseRoutes);

// 注册路由
app.use('/api/help-people', helpPeopleRoutes);

// =====================
// 路由调试端点
// =====================

app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  const getRoutes = (stack, basePath = '') => {
    stack.forEach((middleware) => {
      if (middleware.route) {
        const path = basePath + middleware.route.path;
        const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
        routes.push({ path, methods });
      } else if (middleware.name === 'router') {
        const routerPath = basePath + (middleware.regexp.toString().replace(/^\/\^\\/, '').replace(/\\\/\?\(\?=\/|\$\)\/$/g, '') || '');
        getRoutes(middleware.handle.stack, routerPath);
      }
    });
  };
  
  getRoutes(app._router.stack);
  
  console.log(`[Debug] 🔧 路由调试端点被访问，共 ${routes.length} 个路由`);
  
  res.json({
    total: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// =====================
// 错误处理
// =====================

console.log('[App] ⚠️  配置错误处理中间件...');

app.use(notFoundHandler);
app.use(errorHandler);

// =====================
// 启动定时任务
// =====================

console.log('[App] ⏰ 启动定时任务...');

// 启动矿池定时任务
startMiningPoolJobs();

console.log('[App] ✅ Express应用初始化完成');
console.log('[App] ========================================');

export default app;

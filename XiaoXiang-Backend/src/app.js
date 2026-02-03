import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './common/middlewares/logger.js';
import { errorHandler, notFoundHandler } from './common/middlewares/error.js';
import { authenticate } from './common/middlewares/auth.js';

// 路由
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import jobRoutes from './modules/jobs/job.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import taskTypeRoutes from './modules/task-types/taskType.routes.js';
import paymentRoutes from './modules/payments/paymentMethod.routes.js';
import withdrawalRoutes from './modules/withdrawals/withdrawal.routes.js';
import transactionRoutes from './modules/transactions/transaction.routes.js';

// 获取 __dirname (ES6 模块)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();

// =====================
// 中间件配置
// =====================

// 日志
app.use(logger);

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// =====================
// 健康检查
// =====================

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: '小象兼职后端 API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API 运行正常'
  });
});

// =====================
// API 路由
// =====================

// 挂载用户到 app（兼容旧代码）
import User from './modules/users/user.model.js';
app.set('User', User);

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/task-types', taskTypeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/transactions', transactionRoutes);

// =====================
// 错误处理
// =====================

// 404 处理
app.use(notFoundHandler);

// 全局错误处理（必须在最后）
app.use(errorHandler);

export default app;

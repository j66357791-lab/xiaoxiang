// 👇 第一行强制设置时区
process.env.TZ = 'Asia/Shanghai';
console.log(`[Server] 🌍 设置时区: ${process.env.TZ}`);
console.log(`[Server] 📅 当前时间: ${new Date().toString()}`);

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './src/common/config/database.js';
import app from './src/app.js';
import Job from './src/modules/jobs/job.model.js';

// 环境变量检查
console.log('[Server] 🔍 检查环境变量...');
console.log(`[Server] 📦 NODE_ENV: ${process.env.NODE_ENV || '未设置，使用默认值: development'}`);
console.log(`[Server] 🚪 PORT: ${process.env.PORT || '未设置，使用默认值: 8080'}`);
console.log(`[Server] 🗄️  MONGODB_URI: ${process.env.MONGODB_URI ? '已设置' : '未设置，将使用默认配置'}`);

// 👇 修改默认端口为 8080 (配合 Dockerfile)
const PORT = process.env.PORT || 8080; 
const NODE_ENV = process.env.NODE_ENV || 'development';

// 检查关键环境变量
const requiredEnvVars = ['MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);

if (missingEnvVars.length > 0) {
  console.error(`[Server] ❌ 缺少必需的环境变量: ${missingEnvVars.join(', ')}`);
  console.error(`[Server] 💡 请确保以下环境变量已设置:`);
  missingEnvVars.forEach(env => console.error(`   - ${env}`));
  
  // 如果是生产环境，直接退出
  if (NODE_ENV === 'production') {
    console.error('[Server] 🚨 生产环境缺少关键配置，进程退出');
    process.exit(1);
  } else {
    console.warn('[Server] ⚠️  开发环境缺少配置，继续启动但可能无法正常工作');
  }
}

console.log('[Server] ========================================');
console.log('[Server] 🚀 小象兼职后端服务器启动中...');
console.log(`[Server] 📍 环境: ${NODE_ENV}`);
console.log(`[Server] 📍 端口: ${PORT}`);
console.log(`[Server] 📍 时区: ${process.env.TZ}`);
console.log(`[Server] 📍 进程ID: ${process.pid}`);
console.log(`[Server] 📍 工作目录: ${process.cwd()}`);
console.log('[Server] ========================================');

// =====================
// 启动服务器
// =====================

const startServer = async () => {
  try {
    console.log('[Server] 🔗 开始连接数据库...');
    
    // 连接数据库
    await connectDB();
    
    console.log('[Server] ✅ 数据库连接成功');
    console.log(`[Server] 📊 数据库名称: ${mongoose.connection.db.databaseName}`);
    console.log(`[Server] 🌐 数据库主机: ${mongoose.connection.host}`);
    console.log(`[Server] 👤 数据库用户: ${mongoose.connection.user || 'anonymous'}`);

    // 启动 HTTP 服务器
    console.log(`[Server] 🌐 启动HTTP服务器，监听端口: ${PORT}`);
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n[Server] 🎉 服务器启动成功!');
      console.log('[Server] ========================================');
      console.log(`[Server] 📍 环境: ${NODE_ENV}`);
      console.log(`[Server] 📍 地址: http://localhost:${PORT}`);
      console.log(`[Server] 📍 外部地址: http://0.0.0.0:${PORT}`);
      console.log(`[Server] 📍 时间: ${new Date().toISOString()}`);
      console.log(`[Server] 📍 进程ID: ${process.pid}`);
      console.log('[Server] ========================================');
      console.log('\n[Server] 🔗 可用端点:');
      console.log(`[Server]    - 主页: http://localhost:${PORT}/`);
      console.log(`[Server]    - 健康检查: http://localhost:${PORT}/health`);
      console.log(`[Server]    - 详细健康检查: http://localhost:${PORT}/health-check`);
      console.log(`[Server]    - 路由调试: http://localhost:${PORT}/api/debug/routes`);
      console.log(`[Server]    - 认证: http://localhost:${PORT}/api/auth`);
      console.log(`[Server]    - 任务: http://localhost:${PORT}/api/jobs`);
      console.log(`[Server]    - 订单: http://localhost:${PORT}/api/orders`);
      console.log('[Server] ========================================');
      
      // 内存使用情况
      const memory = process.memoryUsage();
      console.log(`[Server] 💾 内存使用:`);
      console.log(`[Server]    - RSS: ${Math.round(memory.rss / 1024 / 1024)} MB`);
      console.log(`[Server]    - 堆总计: ${Math.round(memory.heapTotal / 1024 / 1024)} MB`);
      console.log(`[Server]    - 堆使用: ${Math.round(memory.heapUsed / 1024 / 1024)} MB`);
      console.log('[Server] ========================================');
    });

    // 服务器错误处理
    server.on('error', (error) => {
      console.error('[Server] ❌ 服务器错误详情:');
      console.error(`[Server]   错误名称: ${error.name}`);
      console.error(`[Server]   错误信息: ${error.message}`);
      console.error(`[Server]   错误代码: ${error.code}`);
      console.error(`[Server]   错误堆栈: ${error.stack}`);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`[Server] 🚨 端口 ${PORT} 已被占用，请使用其他端口`);
        console.error(`[Server] 💡 解决方案:`);
        console.error(`[Server]    1. 停止占用该端口的进程`);
        console.error(`[Server]    2. 修改环境变量 PORT`);
        console.error(`[Server]    3. 等待60秒后重试`);
      } else if (error.code === 'EACCES') {
        console.error(`[Server] 🚨 权限不足，无法监听端口 ${PORT}`);
        console.error(`[Server] 💡 解决方案:`);
        console.error(`[Server]    1. 使用更高权限运行 (如 sudo)`);
        console.error(`[Server]    2. 使用1024以上的端口`);
        console.error(`[Server]    3. 检查防火墙设置`);
      }
      
      console.error('[Server] 💥 由于服务器错误，进程退出');
      process.exit(1);
    });

    // 连接处理
    server.on('connection', (socket) => {
      const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`[Server] 🔌 新客户端连接: ${clientAddress}`);
      
      socket.on('close', () => {
        console.log(`[Server] 🔌 客户端断开连接: ${clientAddress}`);
      });
    });

    // 定时任务：每分钟检查过期任务
    console.log('[Server] ⏰ 启动定时任务：每分钟检查过期任务');
    
    setInterval(async () => {
      try {
        console.log('[Server] ⏰ 执行定时任务：检查任务截止日期...');
        const count = await Job.checkDeadlines();
        if (count > 0) {
          console.log(`[Server] ⏰ 定时任务完成：检查到 ${count} 个任务已自动冻结`);
        } else {
          console.log('[Server] ⏰ 定时任务完成：没有需要处理的任务');
        }
      } catch (err) {
        console.error('[Server] ❌ 定时任务失败:', err);
        console.error('[Server] 🔍 错误详情:', err.stack);
      }
    }, 60 * 1000); // 每分钟执行一次
    
    console.log('[Server] ✅ 定时任务已启动，间隔: 60秒');

  } catch (error) {
    console.error('[Server] 💥 服务器启动失败:');
    console.error(`[Server]   错误名称: ${error.name}`);
    console.error(`[Server]   错误信息: ${error.message}`);
    console.error(`[Server]   错误堆栈: ${error.stack}`);
    
    // 特定错误处理
    if (error.name === 'MongoServerSelectionError') {
      console.error('[Server] 🗄️  MongoDB连接失败，可能原因:');
      console.error('[Server]    1. MongoDB服务未启动');
      console.error('[Server]    2. 网络连接问题');
      console.error('[Server]    3. 认证信息错误');
      console.error('[Server]    4. IP地址未在白名单中');
    } else if (error.name === 'MongooseError') {
      console.error('[Server] 🗄️  Mongoose配置错误');
    }
    
    console.error('[Server] 💥 由于启动失败，进程退出');
    process.exit(1);
  }
};

// =====================
// 进程信号处理
// =====================

console.log('[Server] ⚙️  配置进程信号处理...');

const gracefulShutdown = async (signal) => {
  console.log(`[Server] ⚠️  收到 ${signal} 信号，正在优雅关闭服务器...`);
  
  try {
    // 关闭数据库连接
    if (mongoose.connection.readyState === 1) {
      console.log('[Server] 🔌 正在关闭数据库连接...');
      await mongoose.connection.close();
      console.log('[Server] ✅ 数据库连接已关闭');
    } else {
      console.log(`[Server] 📊 数据库连接状态: ${mongoose.connection.readyState}，跳过关闭`);
    }

    console.log('[Server] 👋 服务器优雅关闭完成');
    console.log(`[Server] 📅 运行时间: ${process.uptime().toFixed(2)} 秒`);
    process.exit(0);
  } catch (error) {
    console.error('[Server] ❌ 关闭过程中发生错误:', error);
    console.error(`[Server]   错误详情: ${error.stack}`);
    process.exit(1);
  }
};

// 信号处理
process.on('SIGTERM', () => {
  console.log('[Server] 📨 收到 SIGTERM 信号 (容器终止信号)');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[Server] 📨 收到 SIGINT 信号 (Ctrl+C)');
  gracefulShutdown('SIGINT');
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('[Server] 💥 未捕获的异常:');
  console.error(`[Server]   错误名称: ${error.name}`);
  console.error(`[Server]   错误信息: ${error.message}`);
  console.error(`[Server]   错误堆栈: ${error.stack}`);
  console.error('[Server] 💥 由于未捕获异常，进程退出');
  process.exit(1);
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] 💥 未处理的 Promise 拒绝:');
  console.error(`[Server]   拒绝原因: ${reason}`);
  console.error(`[Server]   Promise: ${promise}`);
  
  // 对于生产环境，可能不需要退出进程
  if (NODE_ENV === 'production') {
    console.error('[Server] ⚠️  生产环境中未处理的Promise拒绝，记录日志但继续运行');
  } else {
    console.error('[Server] 💥 开发环境中未处理的Promise拒绝，进程退出');
    process.exit(1);
  }
});

// =====================
// 启动
// =====================

console.log('[Server] 🚦 开始启动服务器...');
console.log('[Server] ========================================\n');

// 捕获启动过程中的同步错误
try {
  startServer();
} catch (error) {
  console.error('[Server] 💥 启动过程中发生同步错误:');
  console.error(`[Server]   错误名称: ${error.name}`);
  console.error(`[Server]   错误信息: ${error.message}`);
  console.error(`[Server]   错误堆栈: ${error.stack}`);
  console.error('[Server] 💥 进程退出');
  process.exit(1);
}
// 👇 第一行强制设置时区，确保日志时间正确
process.env.TZ = 'Asia/Shanghai';

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './src/common/config/database.js';
import app from './src/app.js';
import Job from './src/modules/jobs/job.model.js';

// 👇 修改默认端口为 3000，配合 Dockerfile
const PORT = process.env.PORT || 3000; 
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('='.repeat(60));
console.log('🚀 小象兼职后端服务器启动中...');
console.log(`📍 环境: ${NODE_ENV}`);
console.log(`📍 端口: ${PORT}`);
console.log('='.repeat(60));

// =====================
// 启动服务器
// =====================

const startServer = async () => {
  try {
    // 连接数据库
    await connectDB();

    // 启动 HTTP 服务器
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉 服务器启动成功!');
      console.log('='.repeat(60));
      console.log(`📍 环境: ${NODE_ENV}`);
      console.log(`📍 地址: http://localhost:${PORT}`);
      // 👇 注意：toISOString 默认是 UTC 时间，但因为设置了 TZ，它应该会按 Shanghai 计算
      console.log(`📍 时间: ${new Date().toISOString()}`);
      console.log('='.repeat(60));
      console.log('\n🔗 可用端点:');
      console.log(`   - 主页: http://localhost:${PORT}/`);
      console.log(`   - 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`   - 认证: http://localhost:${PORT}/api/auth`);
      console.log(`   - 任务: http://localhost:${PORT}/api/jobs`);
      console.log(`   - 订单: http://localhost:${PORT}/api/orders`);
      console.log('='.repeat(60));
    });

    // 服务器错误处理
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请使用其他端口`);
      } else {
        console.error('❌ 服务器错误:', error);
      }
      process.exit(1);
    });

    // 定时任务：每分钟检查过期任务
    setInterval(async () => {
      try {
        const count = await Job.checkDeadlines();
        if (count > 0) {
          console.log(`[定时任务] 检查到 ${count} 个任务已自动冻结`);
        }
      } catch (err) {
        console.error('[定时任务] 检查任务截止日期失败:', err);
      }
    }, 60 * 1000); // 每分钟执行一次

  } catch (error) {
    console.error('💥 服务器启动失败:', error);
    process.exit(1);
  }
};

// =====================
// 进程信号处理
// =====================

const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  收到 ${signal} 信号，正在关闭服务器...`);

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ 数据库连接已关闭');
    }

    console.log('👋 服务器优雅关闭完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 关闭过程中发生错误:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的 Promise 拒绝:', reason);
});

// =====================
// 启动
// =====================

startServer();

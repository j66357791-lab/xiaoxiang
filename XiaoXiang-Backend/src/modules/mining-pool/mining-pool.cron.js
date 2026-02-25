import cron from 'node-cron';
import { MiningPoolService } from './mining-pool.service.js';

/**
 * 矿池定时任务
 * 使用北京时间（UTC+8）
 */

// 23:00 锁定矿池
export function startMiningPoolJobs() {
  // 23:00 北京时间锁定矿池
  cron.schedule('0 23 * * *', async () => {
    console.log('[Cron] 🔒 开始执行矿池锁定任务...');
    try {
      await MiningPoolService.lockPool();
    } catch (err) {
      console.error('[Cron] 矿池锁定失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  // 23:30 计算分配
  cron.schedule('30 23 * * *', async () => {
    console.log('[Cron] 📊 开始执行矿池计算任务...');
    try {
      await MiningPoolService.calculateDistribution();
    } catch (err) {
      console.error('[Cron] 矿池计算失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  // 00:00 分发小象币
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] 💰 开始执行矿池分发任务...');
    try {
      await MiningPoolService.distributeCoins();
    } catch (err) {
      console.error('[Cron] 矿池分发失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  console.log('[Cron] ✅ 矿池定时任务已启动');
}

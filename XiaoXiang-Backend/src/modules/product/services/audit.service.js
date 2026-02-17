import NightAudit from '../models/nightAudit.model.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

// ==================== 夜审服务 ====================

/**
 * 获取今日审计
 */
export const getTodayAudit = async () => {
  return await NightAudit.getTodayAudit();
};

/**
 * 获取审计历史
 */
export const getAuditHistory = async (days = 7) => {
  return await NightAudit.getHistory(days);
};

/**
 * 执行夜审
 */
export const executeAudit = async (user = null) => {
  return await NightAudit.executeAudit(user?._id);
};

/**
 * 获取审计详情
 */
export const getAuditById = async (id) => {
  const audit = await NightAudit.findById(id);
  if (!audit) throw new Error('审计记录不存在');
  return audit;
};

/**
 * 获取审计统计
 */
export const getAuditStats = async (startDate, endDate) => {
  const match = {};
  
  if (startDate && endDate) {
    match.date = {
      $gte: startDate,
      $lte: endDate
    };
  }
  
  const stats = await NightAudit.aggregate([
    { $match: { ...match, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        totalStockIn: { $sum: '$stockIn' },
        totalStockOut: { $sum: '$stockOut' },
        totalSales: { $sum: '$salesAmount' },
        totalCost: { $sum: '$purchaseCost' },
        totalProfit: { $sum: '$productProfit' },
        totalOrders: { $sum: '$orderCount' },
        totalCompleted: { $sum: '$completedCount' },
        avgProfit: { $avg: '$productProfit' }
      }
    }
  ]);
  
  return stats[0] || {
    totalDays: 0,
    totalStockIn: 0,
    totalStockOut: 0,
    totalSales: 0,
    totalCost: 0,
    totalProfit: 0,
    totalOrders: 0,
    totalCompleted: 0,
    avgProfit: 0
  };
};

export default {
  getTodayAudit,
  getAuditHistory,
  executeAudit,
  getAuditById,
  getAuditStats
};

import RecycleOrder from '../models/recycleOrder.model.js';
import mongoose from 'mongoose';

/**
 * 获取收益概览
 */
export const getOverview = async (range = 'today') => {
  const now = new Date();
  let startDate = new Date();
  
  switch (range) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    default:
      startDate.setHours(0, 0, 0, 0);
  }
  
  // 聚合统计
  const stats = await RecycleOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$saleBindInfo.salePrice' },
        totalSettle: { $sum: { $cond: [{ $eq: ['$status', 'settled'] }, '$userProfit', 0] } },
        totalProfit: { $sum: { $subtract: ['$saleBindInfo.salePrice', '$recyclePrice'] } },
        pendingSettle: { $sum: { $cond: [{ $in: ['$status', ['approved', 'bound']] }, '$userProfit', 0] } },
        orderCount: { $sum: 1 }
      }
    }
  ]);
  
  // 今日统计
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayStats = await RecycleOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: todayStart }
      }
    },
    {
      $group: {
        _id: null,
        todayIncome: { $sum: '$saleBindInfo.salePrice' },
        todaySettle: { $sum: { $cond: [{ $eq: ['$status', 'settled'] }, '$userProfit', 0] } }
      }
    }
  ]);
  
  const result = {
    totalIncome: stats[0]?.totalIncome || 0,
    totalSettle: stats[0]?.totalSettle || 0,
    totalProfit: stats[0]?.totalProfit || 0,
    pendingSettle: stats[0]?.pendingSettle || 0,
    orderCount: stats[0]?.orderCount || 0,
    todayIncome: todayStats[0]?.todayIncome || 0,
    todaySettle: todayStats[0]?.todaySettle || 0
  };
  
  return result;
};

/**
 * 获取结算预警
 */
export const getSettleWarnings = async () => {
  const now = new Date();
  const warnings = [];
  
  // 检查未来7天的结算预警
  for (let i = 1; i <= 7; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);
    targetDate.setHours(23, 59, 59, 999);
    
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const orders = await RecycleOrder.find({
      settleDeadline: { $gte: dayStart, $lte: targetDate },
      status: { $in: ['pending', 'paid', 'shipped', 'received', 'bound', 'approved'] }
    });
    
    if (orders.length > 0) {
      warnings.push({
        days: i,
        date: targetDate.toISOString().split('T')[0],
        orders: orders.length,
        totalAmount: orders.reduce((sum, o) => sum + o.userProfit, 0),
        orderList: orders.map(o => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          productName: o.productName,
          userProfit: o.userProfit
        }))
      });
    }
  }
  
  return warnings;
};

/**
 * 获取资金预测
 */
export const getFundForecast = async (days = 7) => {
  const now = new Date();
  const forecast = [];
  
  // 获取当前待结算总额
  const pendingOrders = await RecycleOrder.find({
    status: { $in: ['approved', 'bound'] }
  });
  const currentPendingSettle = pendingOrders.reduce((sum, o) => sum + o.userProfit, 0);
  
  // 获取当前平台余额（模拟，实际应从用户余额获取）
  const currentBalance = 10000; // 模拟数据
  
  for (let i = 1; i <= days; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);
    
    // 查找该日期到期的订单
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dueOrders = await RecycleOrder.find({
      settleDeadline: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['pending', 'paid', 'shipped', 'received', 'bound', 'approved'] }
    });
    
    const settleAmount = dueOrders.reduce((sum, o) => sum + o.userProfit, 0);
    
    // 预计收入（模拟）
    const expectedIncome = Math.floor(Math.random() * 500) + 100;
    
    // 计算盈余
    const surplus = expectedIncome - settleAmount;
    
    // 判断状态
    let status = 'normal';
    if (surplus < 0) status = 'warning';
    if (surplus < -1000) status = 'danger';
    
    forecast.push({
      days: i,
      date: targetDate.toISOString().split('T')[0],
      income: expectedIncome,
      settleAmount,
      surplus,
      status,
      orderCount: dueOrders.length
    });
  }
  
  return forecast;
};

export default {
  getOverview,
  getSettleWarnings,
  getFundForecast
};

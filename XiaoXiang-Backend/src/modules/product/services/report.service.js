import RecycleOrder from '../models/recycleOrder.model.js';
import Product from '../models/product.model.js';
import mongoose from 'mongoose';

// 获取回收中心分类ID
const getRecycleCategoryId = async () => {
  const Category = mongoose.model('Category');
  const recycleCategory = await Category.findOne({ 
    name: { $regex: '回收', $options: 'i' } 
  });
  return recycleCategory?._id;
};

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
  
  const stats = await RecycleOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$bindInfo.salePrice' },
        totalSettle: { $sum: { $cond: [{ $eq: ['$status', 'settled'] }, '$userProfit', 0] } },
        totalProfit: { $sum: { $subtract: ['$bindInfo.salePrice', '$recyclePrice'] } },
        pendingSettle: { $sum: { $cond: [{ $in: ['$status', ['approved', 'bound']] }, '$userProfit', 0] } },
        orderCount: { $sum: 1 }
      }
    }
  ]);
  
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
        todayIncome: { $sum: '$bindInfo.salePrice' },
        todaySettle: { $sum: { $cond: [{ $eq: ['$status', 'settled'] }, '$userProfit', 0] } }
      }
    }
  ]);
  
  return {
    totalIncome: stats[0]?.totalIncome || 0,
    totalSettle: stats[0]?.totalSettle || 0,
    totalProfit: stats[0]?.totalProfit || 0,
    pendingSettle: stats[0]?.pendingSettle || 0,
    orderCount: stats[0]?.orderCount || 0,
    todayIncome: todayStats[0]?.todayIncome || 0,
    todaySettle: todayStats[0]?.todaySettle || 0
  };
};

/**
 * 获取结算预警
 */
export const getSettleWarnings = async () => {
  const now = new Date();
  const warnings = [];
  
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
        totalAmount: orders.reduce((sum, o) => sum + (o.userProfit || 0), 0),
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
  
  const pendingOrders = await RecycleOrder.find({
    status: { $in: ['approved', 'bound'] }
  });
  const currentPendingSettle = pendingOrders.reduce((sum, o) => sum + (o.userProfit || 0), 0);
  
  for (let i = 1; i <= days; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);
    
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dueOrders = await RecycleOrder.find({
      settleDeadline: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['pending', 'paid', 'shipped', 'received', 'bound', 'approved'] }
    });
    
    const settleAmount = dueOrders.reduce((sum, o) => sum + (o.userProfit || 0), 0);
    const expectedIncome = settleAmount > 0 ? settleAmount * 1.2 : 0;
    const surplus = expectedIncome - settleAmount;
    
    let status = 'normal';
    if (surplus >= 0) status = 'sufficient';
    else if (surplus >= -1000) status = 'warning';
    else status = 'danger';
    
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

/**
 * 获取库存统计
 */
export const getStockStats = async () => {
  const recycleCategoryId = await getRecycleCategoryId();
  let filter = {};
  
  if (recycleCategoryId) {
    filter.categoryId = recycleCategoryId;
  }
  
  const stats = await Product.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
        totalProfit: { $sum: '$profit' },
        lowStockCount: { 
          $sum: { 
            $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] 
          } 
        },
        emptyStockCount: { 
          $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } 
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    totalProfit: 0,
    lowStockCount: 0,
    emptyStockCount: 0
  };
};

export default {
  getOverview,
  getSettleWarnings,
  getFundForecast,
  getStockStats
};

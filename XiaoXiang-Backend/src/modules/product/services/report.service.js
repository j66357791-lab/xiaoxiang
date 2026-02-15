import RecycleOrder from '../models/recycleOrder.model.js';
import StockLog from '../models/stockLog.model.js';
import DailyReport from '../models/report.model.js';

export const generateDailyReport = async (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const orders = await RecycleOrder.find({ createdAt: { $gte: yesterday, $lt: today } });
  const stockLogs = await StockLog.find({ module: 'stock', createdAt: { $gte: yesterday, $lt: today } }).populate('targetId');
  
  const orderStats = {
    total: orders.length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };
  
  const financialStats = {
    totalIncome: orders.reduce((sum, o) => sum + (o.saleBindInfo?.salePrice || 0), 0),
    totalCost: orders.reduce((sum, o) => sum + (o.recyclePrice * o.quantity), 0),
    totalProfit: 0,
    totalSettled: orders.filter(o => ['settled', 'completed'].includes(o.status)).reduce((sum, o) => sum + o.userProfit, 0),
    pendingSettle: orders.filter(o => !['settled', 'completed', 'cancelled'].includes(o.status)).reduce((sum, o) => sum + o.userProfit, 0),
  };
  financialStats.totalProfit = financialStats.totalIncome - financialStats.totalCost;
  
  const stockChanges = stockLogs.map(log => ({
    productId: log.targetId?._id, productName: log.targetId?.name, change: log.changes.diff, reason: log.reason
  }));
  
  const report = new DailyReport({
    reportDate: yesterday, generatedBy: user._id, orderStats, financialStats, stockChanges
  });
  
  await report.save();
  return report;
};

export const getReports = async () => {
  return await DailyReport.find().sort({ reportDate: -1 }).limit(30);
};

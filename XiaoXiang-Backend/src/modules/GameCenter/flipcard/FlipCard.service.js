// src/modules/stats/stats.service.js
import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

// ==================== 类型定义 ====================

/**
 * 定义所有休闲中心相关的流水类型
 */
const LEISURE_TYPES = {
  // 通用积分类型
  general: [
    'points_income', 'points_expense',
    'coins_income', 'coins_expense',
    'points_exchange', 'coins_exchange',
    'gift_purchase'
  ],
  // 翻牌游戏
  flipcard: ['flipcard_ticket', 'flipcard_reward', 'flipcard_fee'],
  // 转盘游戏
  wheel: ['wheel_ticket', 'wheel_reward', 'wheel_jackpot', 'wheel_settle_fee'],
  // 神秘商店
  mysteryShop: ['mystery_shop_progress', 'mystery_shop_reward'],
  // 猜拳游戏
  caiquan: ['caiquan_ticket', 'caiquan_reward']
};

// 获取所有类型的扁平数组
const ALL_LEISURE_TYPES = Object.values(LEISURE_TYPES).flat();

// ==================== 服务函数 ====================

/**
 * 获取货币总览统计（用户端简化版）
 */
async function getCurrencyOverview() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 定义发行(收入)和销毁(支出)类型
  const issuedTypes = [
    'points_income', 'points_exchange', 'coins_income', 'coins_exchange',
    'flipcard_reward', 'wheel_reward', 'wheel_jackpot', 'mystery_shop_reward', 'caiquan_reward'
  ];
  const destroyedTypes = [
    'points_expense', 'coins_expense',
    'flipcard_ticket', 'flipcard_fee', 
    'wheel_ticket', 'wheel_settle_fee', 
    'mystery_shop_progress',
    'caiquan_ticket'
  ];

  const [
    pointsTotalIssued,
    pointsTotalDestroyed,
    pointsInCirculation,
    pointsTodayIssued,
    pointsTodayDestroyed
  ] = await Promise.all([
    Transaction.aggregate([
      { $match: { type: { $in: issuedTypes } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { $match: { type: { $in: destroyedTypes } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    User.aggregate([
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]),
    Transaction.aggregate([
      { $match: { type: { $in: issuedTypes }, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { $match: { type: { $in: destroyedTypes }, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  const issued = pointsTotalIssued[0]?.total || 0;
  const destroyed = pointsTotalDestroyed[0]?.total || 0;
  const circulation = pointsInCirculation[0]?.total || 0;

  return {
    points: {
      totalIssued: issued,
      totalDestroyed: destroyed,
      inCirculation: circulation,
      todayIssued: pointsTodayIssued[0]?.total || 0,
      todayDestroyed: pointsTodayDestroyed[0]?.total || 0
    }
  };
}

/**
 * 获取详细货币统计（管理员）
 */
async function getCurrencyDetail(days = 30) {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const overview = await getCurrencyOverview();
  const dailyTrend = await getDailyTrend(startDate);
  const typeDistribution = await getTypeDistribution(startDate);

  return {
    overview,
    dailyTrend,
    typeDistribution,
    period: { start: startDate, end: now, days }
  };
}

/**
 * 获取每日趋势
 */
async function getDailyTrend(startDate) {
  const issuedTypes = ['points_income', 'points_exchange'];
  const destroyedTypes = ['points_expense'];

  const [issued, destroyed] = await Promise.all([
    Transaction.aggregate([
      { $match: { type: { $in: issuedTypes }, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ]),
    Transaction.aggregate([
      { $match: { type: { $in: destroyedTypes }, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  return {
    issued: issued.map(d => ({ date: d._id, amount: d.total })),
    destroyed: destroyed.map(d => ({ date: d._id, amount: d.total }))
  };
}

/**
 * 获取交易类型分布
 */
async function getTypeDistribution(startDate) {
  const distribution = await Transaction.aggregate([
    { $match: { type: { $in: ALL_LEISURE_TYPES }, createdAt: { $gte: startDate } } },
    { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    { $sort: { total: -1 } }
  ]);

  return distribution.map(d => ({ type: d._id, count: d.count, total: d.total }));
}

/**
 * 获取用户休闲中心流水（7天）
 */
async function getUserLeisureTransactions(userId, page = 1, limit = 20) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    type: { $in: ALL_LEISURE_TYPES },
    createdAt: { $gte: sevenDaysAgo }
  };

  const skip = (page - 1) * limit;
  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments(filter);

  return {
    transactions,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
  };
}

/**
 * 获取货币流水明细（管理员，分页）
 */
async function getCurrencyTransactions(query) {
  const { type, startDate, endDate, page = 1, limit = 20 } = query;
  
  const filter = {
    type: type ? type : { $in: ALL_LEISURE_TYPES }
  };

  // 时间范围（默认30天）
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  } else {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    filter.createdAt = { $gte: thirtyDaysAgo };
  }

  const skip = (page - 1) * limit;

  const transactions = await Transaction.find(filter)
    .populate('userId', 'email name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments(filter);

  // 计算汇总
  const summary = await Transaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    transactions,
    summary,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * 导出货币流水Excel（管理员）
 */
async function exportCurrencyTransactions(query) {
  const { type, startDate, endDate } = query;
  
  const filter = {
    type: type ? type : { $in: ALL_LEISURE_TYPES }
  };

  // 时间范围
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  } else {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    filter.createdAt = { $gte: thirtyDaysAgo };
  }

  // 查询所有数据（限制10000条）
  const transactions = await Transaction.find(filter)
    .populate('userId', 'email name')
    .sort({ createdAt: -1 })
    .limit(10000);

  // 类型映射
  const typeLabels = {
    'points_income': '积分获得',
    'points_expense': '积分消费',
    'coins_income': '小象币获得',
    'coins_expense': '小象币消费',
    'points_exchange': '积分兑换',
    'coins_exchange': '小象币兑换',
    'flipcard_ticket': '翻牌门票',
    'flipcard_reward': '翻牌奖励',
    'flipcard_fee': '翻牌手续费',
    'wheel_ticket': '转盘门票',
    'wheel_reward': '转盘奖励',
    'wheel_jackpot': '转盘大奖',
    'wheel_settle_fee': '转盘手续费',
    'mystery_shop_progress': '神秘商店进度',
    'mystery_shop_reward': '神秘商店奖励',
    'caiquan_ticket': '猜拳门票',
    'caiquan_reward': '猜拳奖励'
  };

  // 生成CSV格式（Excel兼容）
  const headers = ['序号', '用户邮箱', '用户姓名', '类型', '金额', '描述', '时间'];
  const rows = transactions.map((t, index) => [
    index + 1,
    t.userId?.email || '-',
    t.userId?.name || '-',
    typeLabels[t.type] || t.type,
    t.amount,
    t.description || '-',
    new Date(t.createdAt).toLocaleString('zh-CN')
  ]);

  // 构建CSV内容
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // 添加BOM以支持中文
  const bom = '\uFEFF';
  const csvWithBom = bom + csvContent;

  return {
    csvContent: csvWithBom,
    filename: `货币流水_${new Date().toISOString().split('T')[0]}.csv`,
    count: transactions.length
  };
}

// 导出服务对象
export const StatsService = {
  LEISURE_TYPES,
  ALL_LEISURE_TYPES,
  getCurrencyOverview,
  getCurrencyDetail,
  getDailyTrend,
  getTypeDistribution,
  getUserLeisureTransactions,
  getCurrencyTransactions,
  exportCurrencyTransactions
};

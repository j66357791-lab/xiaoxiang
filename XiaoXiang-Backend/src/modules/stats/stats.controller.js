import { success, paginated } from '../../common/utils/response.js';
import { StatsService } from './stats.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import Transaction from '../transactions/transaction.model.js';
import User from '../users/user.model.js';
import mongoose from 'mongoose';

export class StatsController {
  /**
   * 获取货币总览（用户端）
   */
  static getCurrencyOverview = asyncHandler(async (req, res) => {
    const stats = await StatsService.getCurrencyOverview();
    return success(res, stats, '获取货币总览成功');
  });

  /**
   * 获取详细货币统计（管理员）
   */
  static getCurrencyDetail = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const stats = await StatsService.getCurrencyDetail(parseInt(days));
    return success(res, stats, '获取货币详细统计成功');
  });

  /**
   * 获取货币流水明细（管理员，分页）
   */
  static getCurrencyTransactions = asyncHandler(async (req, res) => {
    const { type, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const leisureTypes = [
      'points_income', 'points_expense',
      'coins_income', 'coins_expense',
      'points_exchange', 'coins_exchange'
    ];

    const filter = {
      type: type ? type : { $in: leisureTypes }
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

    return success(res, {
      transactions,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    }, '获取货币流水成功');
  });

  /**
   * 导出货币流水Excel（管理员）
   */
  static exportCurrencyTransactions = asyncHandler(async (req, res) => {
    const { type, startDate, endDate } = req.query;
    
    const leisureTypes = [
      'points_income', 'points_expense',
      'coins_income', 'coins_expense',
      'points_exchange', 'coins_exchange'
    ];

    const filter = {
      type: type ? type : { $in: leisureTypes }
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
      'coins_exchange': '小象币兑换'
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

    // 设置响应头
    const filename = `货币流水_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    console.log(`[Stats] 📊 导出货币流水: ${transactions.length} 条记录`);
    res.send(csvWithBom);
  });

  /**
   * 获取用户休闲中心流水（7天）
   */
  static getUserLeisureTransactions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const leisureTypes = [
      'points_income', 'points_expense',
      'coins_income', 'coins_expense',
      'points_exchange', 'coins_exchange'
    ];

    // 7天前
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      type: { $in: leisureTypes },
      createdAt: { $gte: sevenDaysAgo }
    };

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    // 计算概览统计
    const overview = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            category: {
              $switch: {
                branches: [
                  { case: { $in: ['$type', ['points_income', 'points_exchange']] }, then: 'points_income' },
                  { case: { $in: ['$type', ['points_expense']] }, then: 'points_expense' },
                  { case: { $in: ['$type', ['coins_income', 'coins_exchange']] }, then: 'coins_income' },
                  { case: { $in: ['$type', ['coins_expense']] }, then: 'coins_expense' }
                ],
                default: 'other'
              }
            }
          },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // 整理概览数据
    const overviewData = {
      points: { earned: 0, spent: 0 },
      coins: { earned: 0, spent: 0 }
    };

    overview.forEach(item => {
      if (item._id.category === 'points_income') overviewData.points.earned = item.total;
      if (item._id.category === 'points_expense') overviewData.points.spent = item.total;
      if (item._id.category === 'coins_income') overviewData.coins.earned = item.total;
      if (item._id.category === 'coins_expense') overviewData.coins.spent = item.total;
    });

    return success(res, {
      overview: overviewData,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      period: {
        start: sevenDaysAgo,
        end: new Date()
      }
    }, '获取休闲中心流水成功');
  });
}

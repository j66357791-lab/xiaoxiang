import mongoose from 'mongoose';

import Transaction from './transaction.model.js';
import { TRANSACTION_TYPE, TRANSACTION_STATUS } from '../../common/config/constants.js';

export class TransactionService {
  /**
   * 获取用户的交易记录
   */
  static async getUserTransactions(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({ userId });

    return { transactions, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 获取所有交易记录（管理员）
   */
  static async getAllTransactions(query = {}) {
    const { status = TRANSACTION_STATUS.COMPLETED, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ status })
      .populate('userId', 'email name')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({ status });

    return { transactions, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 获取用户统计数据（由 UserService 调用）
   */
  static async getUserStats(userId) {
    // 👇 修复：检查 userId 是否存在
    if (!userId) {
      throw new Error('用户ID不能为空');
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 👇 修复：安全地转换 ObjectId
    let userIdObj;
    try {
      userIdObj = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      throw new Error('无效的用户ID格式');
    }

    // 今日收入聚合
    const todayIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          type: TRANSACTION_TYPE.INCOME,
          createdAt: { $gte: startOfToday }
        }
      },
      {
        $group: { _id: null, total: { $sum: '$amount' } }
      }
    ]);

    // 本月收入聚合
    const monthIncomeAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userIdObj,
          type: TRANSACTION_TYPE.INCOME,
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: { _id: null, total: { $sum: '$amount' } }
      }
    ]);

    const dailyIncome = todayIncomeAgg.length > 0 ? todayIncomeAgg[0].total : 0;
    const monthlyIncome = monthIncomeAgg.length > 0 ? monthIncomeAgg[0].total : 0;

    return { dailyIncome, monthlyIncome };
  }
}

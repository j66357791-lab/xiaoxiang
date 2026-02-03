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
   * 👈 修复：添加 new 关键字
   */
  static async getUserStats(userId) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 👈 修复：必须使用 new mongoose.Types.ObjectId
    const userIdObj = new mongoose.Types.ObjectId(userId);

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

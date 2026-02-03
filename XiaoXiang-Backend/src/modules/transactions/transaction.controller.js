import { success, paginated } from '../../common/utils/response.js';
import { TransactionService } from './transaction.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class TransactionController {
  /**
   * 获取我的交易记录
   */
  static getMyTransactions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await TransactionService.getUserTransactions(userId, page, limit);
    return paginated(res, result.transactions, result);
  });

  /**
   * 获取用户统计数据
   */
  static getUserStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const stats = await TransactionService.getUserStats(userId);
    return success(res, stats);
  });

  /**
   * 获取所有交易记录（管理员）
   */
  static getAllTransactions = asyncHandler(async (req, res) => {
    const result = await TransactionService.getAllTransactions(req.query);
    return paginated(res, result.transactions, result);
  });
}

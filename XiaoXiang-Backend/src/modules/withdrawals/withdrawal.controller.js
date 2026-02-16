import { success } from '../../common/utils/response.js';
import { WithdrawalService } from './withdrawal.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class WithdrawalController {
  /**
   * 获取我的提现记录
   */
  static getMyWithdrawals = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const withdrawals = await WithdrawalService.getUserWithdrawals(userId);
    return success(res, withdrawals);
  });

  /**
   * 申请提现
   */
  static requestWithdrawal = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { amount } = req.body;

    const withdrawal = await WithdrawalService.createWithdrawal(userId, amount);
    return success(res, withdrawal, '提现申请已提交，请等待审核', 201);
  });

  /**
   * 获取待审核的提现申请（管理员）
   */
  static getPendingWithdrawals = asyncHandler(async (req, res) => {
    const withdrawals = await WithdrawalService.getPendingWithdrawals();
    return success(res, withdrawals);
  });

  /**
   * 审核提现 / 确认打款（管理员）
   */
  static auditWithdrawal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, remark } = req.body;

    const withdrawal = await WithdrawalService.auditWithdrawal(id, status, remark);
    return success(res, withdrawal, '操作成功');
  });
}

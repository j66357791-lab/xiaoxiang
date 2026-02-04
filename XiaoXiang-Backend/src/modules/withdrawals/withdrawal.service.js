import Withdrawal from './withdrawal.model.js';
import PaymentMethod from '../payments/paymentMethod.model.js';
import { UserService } from '../users/user.service.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';
import { WITHDRAWAL_STATUS, PAYMENT_METHOD_STATUS } from '../../common/config/constants.js';

export class WithdrawalService {
  /**
   * 获取用户的提现记录
   */
  static async getUserWithdrawals(userId) {
    return await Withdrawal.find({ userId })
      .populate('paymentMethodId')
      .sort({ createdAt: -1 });
  }

  /**
   * 申请提现
   */
  static async createWithdrawal(userId, amount) {
    // 1. 检查今日是否已提现该金额档位
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existing = await Withdrawal.findOne({
      userId,
      amount,
      status: { $in: [WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.APPROVED, WITHDRAWAL_STATUS.COMPLETED] },
      requestTime: { $gte: startOfToday }
    });

    if (existing) {
      throw new BadRequestError('该金额档位今日已申请提现，请明日再试');
    }

    // 2. 检查是否有已审核通过的收款方式
    const paymentMethods = await PaymentMethod.find({
      userId,
      status: PAYMENT_METHOD_STATUS.APPROVED
    });

    if (paymentMethods.length === 0) {
      throw new BadRequestError('请先绑定并通过审核的收款方式');
    }

    // 3. 检查余额
    const user = await UserService.findById(userId);
    if (user.balance < amount) {
      throw new BadRequestError('余额不足');
    }

    // 4. 创建提现申请并扣除余额
    const withdrawal = await Withdrawal.create({
      userId,
      amount,
      paymentMethodId: paymentMethods[0]._id,
      status: WITHDRAWAL_STATUS.PENDING
    });

    await UserService.subtractBalance(userId, amount, '提现申请');

    return withdrawal;
  }

  /**
   * 获取待审核的提现申请（管理员）
   */
  static async getPendingWithdrawals() {
    return await Withdrawal.find({
      status: { $in: [WITHDRAWAL_STATUS.PENDING, WITHDRAWAL_STATUS.APPROVED] }
    })
      .populate('userId', 'email name')
      .populate('paymentMethodId', 'type accountNo qrCode bankName')
      .sort({ createdAt: -1 });
  }

  /**
   * 审核提现 / 确认打款（管理员）
   */
  static async auditWithdrawal(id, status, remark) {
    const withdrawal = await Withdrawal.findById(id).populate('userId');
    if (!withdrawal) throw new NotFoundError('提现申请不存在');

    const validStatuses = [WITHDRAWAL_STATUS.APPROVED, WITHDRAWAL_STATUS.REJECTED, WITHDRAWAL_STATUS.COMPLETED];

    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的提现状态');
    }

    // Pending -> Approved/Rejected
    if (withdrawal.status === WITHDRAWAL_STATUS.PENDING) {
      if (status === WITHDRAWAL_STATUS.REJECTED) {
        // 拒绝：退回余额
        withdrawal.status = status;
        withdrawal.auditRemark = remark;
        withdrawal.auditTime = new Date();

        await UserService.addBalance(
          withdrawal.userId._id,
          withdrawal.amount,
          null,
          '提现被驳回，余额已退回'
        );
      } else if (status === WITHDRAWAL_STATUS.APPROVED) {
        // 通过
        withdrawal.status = status;
        withdrawal.auditRemark = remark;
        withdrawal.auditTime = new Date();
      }
    }
    // Approved -> Completed
    else if (withdrawal.status === WITHDRAWAL_STATUS.APPROVED && status === WITHDRAWAL_STATUS.COMPLETED) {
      withdrawal.status = status;
      withdrawal.payoutTime = new Date();
    }

    await withdrawal.save();
    return withdrawal;
  }
}

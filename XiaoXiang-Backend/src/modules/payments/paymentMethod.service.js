import PaymentMethod from './paymentMethod.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';
import { PAYMENT_METHOD_STATUS, PAYMENT_METHOD_TYPE } from '../../common/config/constants.js';

export class PaymentMethodService {
  /**
   * 获取用户的支付方式
   */
  static async getUserPaymentMethods(userId) {
    return await PaymentMethod.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * 提交支付方式
   */
  static async createPaymentMethod(userId, type, accountNo, bankName, qrCode) {
    if (!PAYMENT_METHOD_TYPE[type]) {
      throw new BadRequestError('无效的支付方式类型');
    }

    if (type !== PAYMENT_METHOD_TYPE.BANK && !accountNo && !qrCode) {
      throw new BadRequestError('请填写账号或上传收款码');
    }

    const method = await PaymentMethod.create({
      userId,
      type,
      accountNo,
      bankName,
      qrCode,
      status: PAYMENT_METHOD_STATUS.PENDING
    });

    return method;
  }

  /**
   * 获取待审核的支付方式（管理员）
   */
  static async getPendingPaymentMethods() {
    return await PaymentMethod.find({ status: PAYMENT_METHOD_STATUS.PENDING })
      .populate('userId', 'email name')
      .sort({ createdAt: -1 });
  }

  /**
   * 审核支付方式（管理员）
   */
  static async auditPaymentMethod(id, status, remark) {
    const validStatuses = [PAYMENT_METHOD_STATUS.APPROVED, PAYMENT_METHOD_STATUS.REJECTED];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的审核状态');
    }

    const method = await PaymentMethod.findById(id);
    if (!method) throw new NotFoundError('支付方式不存在');

    method.status = status;
    method.auditRemark = remark;
    method.auditTime = new Date();

    await method.save();
    return method;
  }
}

import { success } from '../../common/utils/response.js';
import { PaymentMethodService } from './paymentMethod.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class PaymentMethodController {
  /**
   * 获取我的支付方式
   */
  static getMyPaymentMethods = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const methods = await PaymentMethodService.getUserPaymentMethods(userId);
    return success(res, methods);
  });

  /**
   * 提交支付方式
   */
  static bindPaymentMethod = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type, accountNo, bankName } = req.body;
    let qrCode = null;

    if (req.file) {
      qrCode = `/uploads/${req.file.filename}`;
    }

    const method = await PaymentMethodService.createPaymentMethod(
      userId, type, accountNo, bankName, qrCode
    );

    return success(res, method, '申请已提交，等待审核', 201);
  });

  /**
   * 获取待审核的支付方式（管理员）
   */
  static getPendingMethods = asyncHandler(async (req, res) => {
    const methods = await PaymentMethodService.getPendingPaymentMethods();
    return success(res, methods);
  });

  /**
   * 审核支付方式（管理员）
   */
  static auditPaymentMethod = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, remark } = req.body;

    const method = await PaymentMethodService.auditPaymentMethod(id, status, remark);
    return success(res, method, '操作成功');
  });
}

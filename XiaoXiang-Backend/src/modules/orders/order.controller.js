import { success, paginated } from '../../common/utils/response.js';
import { OrderService } from './order.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class OrderController {
  /**
   * 接单
   */
  static applyJob = asyncHandler(async (req, res) => {
    const { jobId, levelIndex } = req.body;
    const userId = req.user._id;

    const order = await OrderService.applyForJob(userId, jobId, levelIndex);
    return success(res, order, '接单成功', 201);
  });

  /**
   * 提交订单
   */
  static submitOrder = asyncHandler(async (req, res) => {
    const { orderId, description } = req.body;
    const userId = req.user._id;

    // 处理上传的凭证
    let evidencePaths = [];
    if (req.files && req.files.length > 0) {
      evidencePaths = req.files.map(file => `/uploads/${file.filename}`);
    }

    const order = await OrderService.submitOrder(orderId, userId, description, evidencePaths);
    return success(res, order, '提交成功');
  });

  /**
   * 获取我的订单
   */
  static getMyOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await OrderService.getUserOrders(userId, page, limit);
    return paginated(res, result.orders, result);
  });

  /**
   * 获取所有订单（管理员）
   */
  static getAllOrders = asyncHandler(async (req, res) => {
    const result = await OrderService.getAllOrders(req.query);
    return paginated(res, result.orders, result);
  });

  /**
   * 获取单个订单
   */
  static getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await OrderService.getOrderById(id);
    return success(res, order);
  });

  /**
   * 更新订单状态（管理员）
   */
  static updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = await OrderService.updateOrderStatus(id, status);
    return success(res, order, '订单状态已更新');
  });

  /**
   * 取消订单
   */
  static cancelOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const order = await OrderService.cancelOrder(id, userId);
    return success(res, order, '订单已取消');
  });
}

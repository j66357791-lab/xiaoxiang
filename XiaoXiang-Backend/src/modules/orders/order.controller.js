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
    const userRole = req.user.role;

    // 处理上传的凭证
    let evidencePaths = [];
    if (req.files && req.files.length > 0) {
      evidencePaths = req.files.map(file => `/uploads/${file.filename}`);
    }

    const order = await OrderService.submitOrder(orderId, userId, description, evidencePaths, userRole);
    return success(res, order, '提交成功');
  });

  /**
   * 获取我的订单
   */
  static getMyOrders = asyncHandler(async (req, res) => {
    // 1. 优先使用 Token (新端)
    let userId = req.user?._id;
    
    // 2. 降级使用 URL 参数 (旧端/未登录调试)
    if (!userId && req.query.userId) {
      userId = req.query.userId;
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未登录或未提供用户ID'
      });
    }

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
    const { status, reason, paymentProof, paymentNote } = req.body;
    const reviewedBy = req.user._id; // 当前操作用户

    const order = await OrderService.updateOrderStatus(id, status, {
      reason,
      reviewedBy,
      paymentProof,
      paymentNote
    });
    return success(res, order, '订单状态已更新');
  });

  /**
   * 取消订单
   */
  static cancelOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const order = await OrderService.cancelOrder(id, userId, userRole, reason);
    return success(res, order, '订单已取消');
  });

  /**
   * 批量更新订单状态（管理员）
   */
  static bulkUpdateOrderStatus = asyncHandler(async (req, res) => {
    const { orderIds, status, reason } = req.body;
    const reviewedBy = req.user._id;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要操作的订单'
      });
    }

    const result = await OrderService.bulkUpdateOrderStatus(orderIds, status, {
      reason,
      reviewedBy
    });

    return success(res, result, '批量操作完成');
  });

  /**
   * 获取订单统计信息（管理员）
   */
  static getOrderStats = asyncHandler(async (req, res) => {
    const { timeRange = 'today' } = req.query;
    const stats = await OrderService.getOrderStats(timeRange);
    return success(res, stats, '统计信息获取成功');
  });
}
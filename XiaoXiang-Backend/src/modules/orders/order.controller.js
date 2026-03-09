// src/modules/orders/order.controller.js
// 回收订单控制器（优化版）

import { success, paginated } from '../../common/utils/response.js';
import { OrderService } from './order.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class OrderController {
  
  /**
   * 创建订单
   */
  static createOrder = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    console.log('[OrderController] 📝 创建回收订单, 用户:', userId);
    const order = await OrderService.createOrder(userId, req.body);
    return success(res, order, '提交成功', 201);
  });
  
  /**
   * 获取我的订单
   */
  static getMyOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await OrderService.getUserOrders(userId, req.query);
    return paginated(res, result.orders, result.pagination);
  });
  
  /**
   * 获取所有订单（管理员）
   */
  static getAllOrders = asyncHandler(async (req, res) => {
    const result = await OrderService.getAllOrders(req.query);
    return paginated(res, result.orders, result.pagination);
  });
  
  /**
   * 获取订单详情
   */
  static getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await OrderService.getOrderById(id);
    return success(res, order);
  });
  
  /**
   * 更新订单状态
   */
  static updateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, ...data } = req.body;
    console.log('[OrderController] 📝 更新订单状态:', id, '->', status);
    const order = await OrderService.updateStatus(id, status, data);
    return success(res, order, '状态更新成功');
  });
  
  /**
   * 填写快递信息
   */
  static fillShippingInfo = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    console.log('[OrderController] 📦 填写快递信息:', id);
    const order = await OrderService.fillShippingInfo(id, userId, req.body);
    return success(res, order, '快递信息已提交');
  });
  
  /**
   * 提交报价
   */
  static submitQuote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[OrderController] 💰 提交报价:', id);
    const order = await OrderService.submitQuote(id, { ...req.body, inspectedBy: req.user._id });
    return success(res, order, '报价已提交');
  });
  
  /**
   * 接受报价
   */
  static acceptQuote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    console.log('[OrderController] ✅ 用户接受报价:', id);
    const order = await OrderService.acceptQuote(id, userId);
    return success(res, order, '已接受报价');
  });
  
  /**
   * 拒绝报价
   */
  static rejectQuote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;
    console.log('[OrderController] ❌ 用户拒绝报价:', id);
    const order = await OrderService.rejectQuote(id, userId, reason);
    return success(res, order, '已拒绝报价');
  });
  
  /**
   * 确认打款
   */
  static confirmPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[OrderController] 💸 确认打款:', id);
    const order = await OrderService.confirmPayment(id, req.body);
    return success(res, order, '打款成功');
  });
  
  /**
   * 取消订单
   */
  static cancelOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;
    console.log('[OrderController] 🗑️ 取消订单:', id);
    const order = await OrderService.cancelOrder(id, userId, reason);
    return success(res, order, '订单已取消');
  });
  
  /**
   * 获取订单统计
   */
  static getOrderStats = asyncHandler(async (req, res) => {
    const stats = await OrderService.getOrderStats(req.query);
    return success(res, stats);
  });
  
  /**
   * 🆕 换绑仓库
   */
  static changeWarehouse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { warehouseId, reason } = req.body;
    const adminId = req.user._id;
    console.log('[OrderController] 🏭 换绑仓库:', id, '->', warehouseId);
    const order = await OrderService.changeWarehouse(id, warehouseId, reason, adminId);
    return success(res, order, '仓库换绑成功');
  });
}

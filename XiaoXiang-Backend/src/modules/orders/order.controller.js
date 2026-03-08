// src/modules/orders/order.controller.js

import { success, paginated } from '../../common/utils/response.js';
import { OrderService } from './order.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class OrderController {
  
  static createOrder = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    console.log('[OrderController] 📝 创建回收订单, 用户:', userId);
    const order = await OrderService.createOrder(userId, req.body);
    return success(res, order, '提交成功', 201);
  });
  
  static getMyOrders = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await OrderService.getUserOrders(userId, req.query);
    return paginated(res, result.orders, result.pagination);
  });
  
  static getAllOrders = asyncHandler(async (req, res) => {
    const result = await OrderService.getAllOrders(req.query);
    return paginated(res, result.orders, result.pagination);
  });
  
  static getOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await OrderService.getOrderById(id);
    return success(res, order);
  });
  
  static updateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, ...data } = req.body;
    console.log('[OrderController] 📝 更新订单状态:', id, '->', status);
    const order = await OrderService.updateStatus(id, status, data);
    return success(res, order, '状态更新成功');
  });
  
  static fillShippingInfo = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    console.log('[OrderController] 📦 填写快递信息:', id);
    const order = await OrderService.fillShippingInfo(id, userId, req.body);
    return success(res, order, '快递信息已提交');
  });
  
  static submitQuote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[OrderController] 💰 提交报价:', id);
    const order = await OrderService.submitQuote(id, { ...req.body, inspectedBy: req.user._id });
    return success(res, order, '报价已提交');
  });
  
  static acceptQuote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    console.log('[OrderController] ✅ 用户接受报价:', id);
    const order = await OrderService.acceptQuote(id, userId);
    return success(res, order, '已接受报价');
  });
  
  static rejectQuote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;
    console.log('[OrderController] ❌ 用户拒绝报价:', id);
    const order = await OrderService.rejectQuote(id, userId, reason);
    return success(res, order, '已拒绝报价');
  });
  
  static confirmPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[OrderController] 💸 确认打款:', id);
    const order = await OrderService.confirmPayment(id, req.body);
    return success(res, order, '打款成功');
  });
  
  static cancelOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;
    console.log('[OrderController] 🗑️ 取消订单:', id);
    const order = await OrderService.cancelOrder(id, userId, reason);
    return success(res, order, '订单已取消');
  });
  
  static getOrderStats = asyncHandler(async (req, res) => {
    const stats = await OrderService.getOrderStats(req.query);
    return success(res, stats);
  });
}

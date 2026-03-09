// src/modules/orders/order.controller.js
// 回收订单控制器（优化版）

import { success, paginated } from '../../common/utils/response.js';
import { OrderService } from './order.service.js';

export class OrderController {
  
  /**
   * 创建订单
   */
  static createOrder = async (req, res, next) => {
    try {
      const userId = req.user._id;
      console.log('[OrderController] 📝 创建回收订单, 用户:', userId);
      const order = await OrderService.createOrder(userId, req.body);
      return success(res, order, '提交成功', 201);
    } catch (error) {
      console.error('[OrderController] 创建订单错误:', error);
      throw error;
    }
  };
  
  /**
   * 获取我的订单
   */
  static getMyOrders = async (req, res, next) => {
    try {
      const userId = req.user._id;
      const result = await OrderService.getUserOrders(userId, req.query);
      return paginated(res, result.orders, result.pagination);
    } catch (error) {
      console.error('[OrderController] 获取订单列表错误:', error);
      throw error;
    }
  };
  
  /**
   * 获取所有订单（管理员）
   */
  static getAllOrders = async (req, res, next) => {
    try {
      const result = await OrderService.getAllOrders(req.query);
      return paginated(res, result.orders, result.pagination);
    } catch (error) {
      console.error('[OrderController] 获取所有订单错误:', error);
      throw error;
    }
  };
  
  /**
   * 获取订单详情
   */
  static getOrderById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id);
      return success(res, order);
    } catch (error) {
      console.error('[OrderController] 获取订单详情错误:', error);
      throw error;
    }
  };
  
  /**
   * 更新订单状态
   */
  static updateStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, ...data } = req.body;
      console.log('[OrderController] 📝 更新订单状态:', id, '->', status);
      const order = await OrderService.updateStatus(id, status, data);
      return success(res, order, '状态更新成功');
    } catch (error) {
      console.error('[OrderController] 更新状态错误:', error);
      throw error;
    }
  };
  
  /**
   * 填写快递信息
   */
  static fillShippingInfo = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      console.log('[OrderController] 📦 填写快递信息:', id);
      const order = await OrderService.fillShippingInfo(id, userId, req.body);
      return success(res, order, '快递信息已提交');
    } catch (error) {
      console.error('[OrderController] 填写快递信息错误:', error);
      throw error;
    }
  };
  
  /**
   * 提交报价
   */
  static submitQuote = async (req, res, next) => {
    try {
      const { id } = req.params;
      console.log('[OrderController] 💰 提交报价:', id);
      const order = await OrderService.submitQuote(id, { ...req.body, inspectedBy: req.user._id });
      return success(res, order, '报价已提交');
    } catch (error) {
      console.error('[OrderController] 提交报价错误:', error);
      throw error;
    }
  };
  
  /**
   * 接受报价
   */
  static acceptQuote = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      console.log('[OrderController] ✅ 用户接受报价:', id);
      const order = await OrderService.acceptQuote(id, userId);
      return success(res, order, '已接受报价');
    } catch (error) {
      console.error('[OrderController] 接受报价错误:', error);
      throw error;
    }
  };
  
  /**
   * 拒绝报价
   */
  static rejectQuote = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;
      console.log('[OrderController] ❌ 用户拒绝报价:', id);
      const order = await OrderService.rejectQuote(id, userId, reason);
      return success(res, order, '已拒绝报价');
    } catch (error) {
      console.error('[OrderController] 拒绝报价错误:', error);
      throw error;
    }
  };
  
  /**
   * 确认打款
   */
  static confirmPayment = async (req, res, next) => {
    try {
      const { id } = req.params;
      console.log('[OrderController] 💸 确认打款:', id);
      const order = await OrderService.confirmPayment(id, req.body);
      return success(res, order, '打款成功');
    } catch (error) {
      console.error('[OrderController] 确认打款错误:', error);
      throw error;
    }
  };
  
  /**
   * 取消订单
   */
  static cancelOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;
      console.log('[OrderController] 🗑️ 取消订单:', id);
      const order = await OrderService.cancelOrder(id, userId, reason);
      return success(res, order, '订单已取消');
    } catch (error) {
      console.error('[OrderController] 取消订单错误:', error);
      throw error;
    }
  };
  
  /**
   * 获取订单统计
   */
  static getOrderStats = async (req, res, next) => {
    try {
      const stats = await OrderService.getOrderStats(req.query);
      return success(res, stats);
    } catch (error) {
      console.error('[OrderController] 获取统计错误:', error);
      throw error;
    }
  };
  
  /**
   * 🆕 换绑仓库
   */
  static changeWarehouse = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { warehouseId, reason } = req.body;
      const adminId = req.user._id;
      console.log('[OrderController] 🏭 换绑仓库:', id, '->', warehouseId);
      const order = await OrderService.changeWarehouse(id, warehouseId, reason, adminId);
      return success(res, order, '仓库换绑成功');
    } catch (error) {
      console.error('[OrderController] 换绑仓库错误:', error);
      throw error;
    }
  };
}

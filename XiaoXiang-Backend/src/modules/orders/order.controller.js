// src/modules/orders/order.controller.js
import { success, paginated } from '../../common/utils/response.js';
import { OrderService } from './order.service.js';

export class OrderController {
  
  static generateOrderNumber = async (req, res) => {
    try {
      const orderNumber = OrderService.generateOrderNumber();
      return success(res, { orderNumber });
    } catch (error) {
      throw error;
    }
  };
  
  static createOrder = async (req, res) => {
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
  
  static getMyOrders = async (req, res) => {
    try {
      const userId = req.user._id;
      const result = await OrderService.getUserOrders(userId, req.query);
      return paginated(res, result.orders, result.pagination);
    } catch (error) {
      throw error;
    }
  };
  
  static getAllOrders = async (req, res) => {
    try {
      const result = await OrderService.getAllOrders(req.query);
      return paginated(res, result.orders, result.pagination);
    } catch (error) {
      throw error;
    }
  };
  
  static getOrderById = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id);
      return success(res, order);
    } catch (error) {
      throw error;
    }
  };
  
  static updateShipping = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { expressCompany, trackingNumber } = req.body;
      
      const order = await OrderService.updateShipping(id, userId, {
        expressCompany,
        trackingNumber,
      });
      return success(res, order, '物流信息已提交');
    } catch (error) {
      throw error;
    }
  };
  
  // 确认收货（管理员）
  static confirmReceive = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await OrderService.confirmReceive(id);
      return success(res, order, '已确认收货');
    } catch (error) {
      throw error;
    }
  };
  
  static updateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, ...data } = req.body;
      const order = await OrderService.updateStatus(id, status, data);
      return success(res, order, '状态更新成功');
    } catch (error) {
      throw error;
    }
  };
  
  static submitQuote = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await OrderService.submitQuote(id, { 
        ...req.body, 
        inspectedBy: req.user._id 
      });
      return success(res, order, '报价已提交');
    } catch (error) {
      throw error;
    }
  };
  
  static acceptQuote = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const order = await OrderService.acceptQuote(id, userId);
      return success(res, order, '已接受报价');
    } catch (error) {
      throw error;
    }
  };
  
  static rejectQuote = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;
      const order = await OrderService.rejectQuote(id, userId, reason);
      return success(res, order, '已拒绝报价');
    } catch (error) {
      throw error;
    }
  };
  
  static cancelOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;
      const order = await OrderService.cancelOrder(id, userId, reason);
      return success(res, order, '订单已取消');
    } catch (error) {
      throw error;
    }
  };
  
  static confirmPayment = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await OrderService.confirmPayment(id, req.body);
      return success(res, order, '打款成功');
    } catch (error) {
      throw error;
    }
  };
}

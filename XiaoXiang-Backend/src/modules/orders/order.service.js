// src/modules/orders/order.service.js

import mongoose from 'mongoose';
import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class OrderService {
  
  static async createOrder(userId, orderData) {
    console.log('[OrderService] 📝 创建回收订单...');
    
    const { jobId, productInfo, shipping, payment } = orderData;
    
    const job = await Job.findById(jobId);
    if (!job) throw new NotFoundError('商品不存在');
    if (job.status !== 'active') throw new BadRequestError('该商品暂不支持回收');
    if (job.isFrozen) throw new BadRequestError('该商品已被冻结');
    
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    const orderNumber = Order.generateOrderNumber();
    
    let estimatedPrice = job.pricing?.basePrice || 0;
    if (productInfo?.condition && job.conditionPrices?.length > 0) {
      const conditionPrice = job.conditionPrices.find(cp => cp.condition === productInfo.condition);
      if (conditionPrice) {
        if (conditionPrice.price) {
          estimatedPrice = conditionPrice.price;
        } else if (conditionPrice.priceRate) {
          estimatedPrice = Math.floor(job.pricing.basePrice * conditionPrice.priceRate);
        }
      }
    }
    
    const order = await Order.create({
      orderNumber,
      userId,
      jobId,
      status: 'Submitted',
      jobSnapshot: {
        title: job.title,
        subtitle: job.subtitle,
        images: job.images,
        coverImage: job.coverImage,
        categories: {
          l1: job.categoryL1 ? { id: job.categoryL1._id, name: job.categoryL1.name } : null,
          l2: job.categoryL2 ? { id: job.categoryL2._id, name: job.categoryL2.name } : null,
          l3: job.categoryL3 ? { id: job.categoryL3._id, name: job.categoryL3.name } : null,
        },
        pricing: job.pricing,
      },
      productInfo: {
        condition: productInfo?.condition,
        conditionNote: productInfo?.conditionNote,
        defects: productInfo?.defects || [],
        accessories: productInfo?.accessories || [],
        purchaseDate: productInfo?.purchaseDate,
        purchaseChannel: productInfo?.purchaseChannel,
        images: productInfo?.images || [],
        description: productInfo?.description,
      },
      pricing: { estimatedPrice },
      shipping: {
        method: shipping?.method || 'express',
        userAddress: shipping?.userAddress,
      },
      payment: {
        method: payment?.method,
        account: payment?.account,
        accountName: payment?.accountName,
        bankName: payment?.bankName,
      },
      warehouse: job.warehouse,
      amount: estimatedPrice,
    });
    
    await Job.findByIdAndUpdate(jobId, { $inc: { 'stats.recycleCount': 1, appliedCount: 1 } });
    
    console.log('[OrderService] ✅ 订单创建成功:', orderNumber);
    return order;
  }
  
  static async getUserOrders(userId, query = {}) {
    const filter = { userId };
    if (query.status) filter.status = query.status;
    
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('jobId', 'title images coverImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);
    
    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  static async getAllOrders(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;
    
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }
    
    if (query.keyword) {
      filter.$or = [
        { orderNumber: { $regex: query.keyword, $options: 'i' } },
        { 'jobSnapshot.title': { $regex: query.keyword, $options: 'i' } },
      ];
    }
    
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'nickname phone avatar')
        .populate('jobId', 'title images')
        .populate('inspection.inspectedBy', 'nickname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);
    
    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  static async getOrderById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id)
      .populate('userId', 'nickname phone avatar')
      .populate('jobId')
      .populate('inspection.inspectedBy', 'nickname')
      .populate('warehouse.id');
    
    if (!order) throw new NotFoundError('订单不存在');
    return order;
  }
  
  static async updateStatus(id, status, data = {}) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    const validTransitions = {
      'Submitted': ['Shipping', 'Cancelled'],
      'Shipping': ['Received', 'Cancelled'],
      'Received': ['Inspecting', 'Cancelled'],
      'Inspecting': ['Quoted'],
      'Quoted': ['Accepted', 'Rejected'],
      'Accepted': ['Completed'],
      'Rejected': ['Returning', 'Completed'],
      'Returning': ['Completed'],
    };
    
    if (!validTransitions[order.status]?.includes(status)) {
      throw new BadRequestError(`不能从 ${order.status} 状态切换到 ${status}`);
    }
    
    order.status = status;
    
    if (data.shipping) order.shipping = { ...order.shipping.toObject(), ...data.shipping };
    if (data.inspection) order.inspection = { ...order.inspection.toObject(), ...data.inspection };
    if (data.pricing) order.pricing = { ...order.pricing.toObject(), ...data.pricing };
    if (data.payment) order.payment = { ...order.payment.toObject(), ...data.payment };
    if (data.cancelReason) order.cancelReason = data.cancelReason;
    if (data.rejectReason) order.rejectReason = data.rejectReason;
    if (data.notes) order.notes = data.notes;
    if (data.adminNotes) order.adminNotes = data.adminNotes;
    
    await order.save();
    return order;
  }
  
  static async fillShippingInfo(id, userId, shippingData) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (order.status !== 'Submitted') throw new BadRequestError('当前状态无法填写快递信息');
    
    order.shipping.expressCompany = shippingData.expressCompany;
    order.shipping.trackingNumber = shippingData.trackingNumber;
    order.shipping.shippedAt = new Date();
    order.status = 'Shipping';
    
    await order.save();
    return order;
  }
  
  static async submitQuote(id, quoteData) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (order.status !== 'Inspecting') throw new BadRequestError('当前状态无法报价');
    
    order.pricing.quotedPrice = quoteData.quotedPrice;
    order.pricing.priceFactors = quoteData.priceFactors || [];
    order.inspection.report = quoteData.report;
    order.inspection.images = quoteData.images || [];
    order.inspection.status = 'passed';
    order.inspection.inspectedAt = new Date();
    order.status = 'Quoted';
    
    await order.save();
    return order;
  }
  
  static async acceptQuote(id, userId) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法接受报价');
    
    order.pricing.finalPrice = order.pricing.quotedPrice;
    order.status = 'Accepted';
    
    await order.save();
    return order;
  }
  
  static async rejectQuote(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法拒绝报价');
    
    order.rejectReason = reason;
    order.status = 'Rejected';
    
    await order.save();
    return order;
  }
  
  static async confirmPayment(id, paymentData) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (order.status !== 'Accepted') throw new BadRequestError('当前状态无法打款');
    
    order.payment.paidAt = new Date();
    order.payment.proof = paymentData.proof;
    order.payment.transactionId = paymentData.transactionId;
    order.status = 'Completed';
    
    await order.save();
    return order;
  }
  
  static async cancelOrder(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (!['Submitted', 'Shipping'].includes(order.status)) throw new BadRequestError('当前状态无法取消');
    
    order.status = 'Cancelled';
    order.cancelReason = reason;
    
    await order.save();
    return order;
  }
  
  static async getOrderStats(query = {}) {
    const { startDate, endDate } = query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchStage = {};
    if (startDate || endDate) matchStage.createdAt = dateFilter;
    
    const stats = await Order.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$pricing.finalPrice' } } },
    ]);
    
    const totalStats = await Order.aggregate([
      { $match: matchStage },
      { $group: { _id: null, totalOrders: { $sum: 1 }, totalAmount: { $sum: '$pricing.finalPrice' } } },
    ]);
    
    return { byStatus: stats, total: totalStats[0] || { totalOrders: 0, totalAmount: 0 } };
  }
}

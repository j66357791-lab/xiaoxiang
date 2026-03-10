// src/modules/orders/order.service.js
import mongoose from 'mongoose';
import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import Warehouse from '../warehouses/warehouse.model.js';
import Coupon from '../coupons/coupon.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class OrderService {
  
  /**
   * 预生成订单号
   */
  static generateOrderNumber() {
    return Order.generateOrderNumber();
  }

  /**
   * 创建回收订单
   */
  static async createOrder(userId, orderData) {
    console.log('[OrderService] 📝 创建回收订单...');
    
    const { jobId, productInfo, shippingMethod, warehouse, pickupInfo, payment, couponId } = orderData;
    
    // 验证商品
    const job = await Job.findById(jobId);
    if (!job) throw new NotFoundError('商品不存在');
    if (job.status !== 'active') throw new BadRequestError('该商品暂不支持回收');
    
    // 验证用户
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    // 生成订单号
    const orderNumber = Order.generateOrderNumber();
    
    // 计算预估价格
    let basePrice = job.estimatedPrice || job.pricing?.basePrice || 0;
    let conditionRate = 1;
    
    // 根据成色调整价格
    if (productInfo?.condition && job.conditionPrices?.length > 0) {
      const conditionPrice = job.conditionPrices.find(cp => cp.condition === productInfo.condition);
      if (conditionPrice) {
        if (conditionPrice.price) {
          basePrice = conditionPrice.price;
        } else if (conditionPrice.priceRate) {
          conditionRate = conditionPrice.priceRate;
        }
      }
    }
    
    const estimatedPrice = Math.floor(basePrice * conditionRate);
    
    // 处理优惠券
    let couponData = null;
    let couponDiscount = 0;
    if (couponId) {
      const coupon = await Coupon.findById(couponId);
      if (coupon) {
        const { canUse } = coupon.canUse(userId, estimatedPrice);
        if (canUse) {
          couponDiscount = coupon.calculateDiscount(estimatedPrice);
          couponData = {
            id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            type: coupon.type,
            value: coupon.value,
            discountAmount: couponDiscount,
          };
        }
      }
    }
    
    // 获取仓库信息
    let warehouseData = null;
    if (shippingMethod === 'express' && warehouse?.id) {
      const wh = await Warehouse.findById(warehouse.id);
      if (wh) {
        warehouseData = {
          id: wh._id,
          name: wh.name,
          address: wh.address,
          phone: wh.contact?.phone,
        };
      }
    }
    
    // 计算最终价格
    const finalPrice = Math.max(0, estimatedPrice - couponDiscount);
    
    // 创建订单
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
        estimatedPrice: job.estimatedPrice,
        estimatedPaymentHours: job.estimatedPaymentHours,
        estimatedInspectDays: job.estimatedInspectDays,
      },
      productInfo: {
        condition: productInfo?.condition,
        description: productInfo?.description,
        images: productInfo?.images || [],
      },
      pricing: {
        basePrice,
        conditionRate,
        estimatedPrice,
        couponDiscount,
        finalPrice,
      },
      coupon: couponData,
      shipping: {
        method: shippingMethod,
      },
      pickupInfo: shippingMethod === 'pickup' ? pickupInfo : undefined,
      warehouse: warehouseData,
      payment: {
        method: payment?.method,
        account: payment?.account,
      },
      amount: finalPrice,
    });
    
    // 使用优惠券
    if (couponData) {
      await Coupon.findByIdAndUpdate(couponData.id, {
        $inc: { usedCount: 1 },
        $push: {
          userClaims: {
            userId,
            usedAt: new Date(),
            orderId: order._id,
          }
        }
      });
    }
    
    // 更新商品统计
    await Job.findByIdAndUpdate(jobId, { 
      $inc: { 'stats.recycleCount': 1, appliedCount: 1 } 
    });
    
    console.log('[OrderService] ✅ 订单创建成功:', orderNumber);
    return order;
  }
  
  /**
   * 获取用户订单列表
   */
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
  
  /**
   * 获取所有订单（管理员）
   */
  static async getAllOrders(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.userId) filter.userId = query.userId;
    
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'nickname email phone avatar')
        .populate('jobId', 'title coverImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);
    
    return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  /**
   * 获取订单详情
   */
  static async getOrderById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id)
      .populate('userId', 'nickname phone avatar email')
      .populate('jobId')
      .populate('warehouse.id');
    
    if (!order) throw new NotFoundError('订单不存在');
    return order;
  }
  
  /**
   * 更新物流信息（用户填写快递单号）
   */
  static async updateShipping(id, userId, shippingData) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    // 验证是否是订单所有者
    if (String(order.userId) !== String(userId)) {
      throw new BadRequestError('无权操作此订单');
    }
    
    // 验证订单状态
    if (!['Submitted', 'Shipping'].includes(order.status)) {
      throw new BadRequestError('当前状态无法填写物流信息');
    }
    
    const { expressCompany, trackingNumber } = shippingData;
    
    if (!trackingNumber) {
      throw new BadRequestError('请填写快递单号');
    }
    
    // 更新物流信息
    order.shipping.expressCompany = expressCompany;
    order.shipping.trackingNumber = trackingNumber;
    order.shipping.shippedAt = new Date();
    order.status = 'Shipping';
    order.timeline.shippedAt = new Date();
    
    await order.save();
    return order;
  }
  
  /**
   * 更新订单状态
   */
  static async updateStatus(id, status, data = {}) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    order.status = status;
    
    // 更新时间线
    const now = new Date();
    switch(status) {
      case 'Shipping': order.timeline.shippedAt = now; break;
      case 'Received': order.timeline.receivedAt = now; break;
      case 'Inspecting': order.timeline.inspectingAt = now; break;
      case 'Quoted': order.timeline.quotedAt = now; break;
      case 'Accepted': order.timeline.acceptedAt = now; break;
      case 'Rejected': order.timeline.rejectedAt = now; break;
      case 'Completed': order.timeline.completedAt = now; break;
      case 'Cancelled': order.timeline.cancelledAt = now; break;
    }
    
    // 更新其他数据
    if (data.shipping) order.shipping = { ...order.shipping.toObject(), ...data.shipping };
    if (data.inspection) order.inspection = { ...order.inspection.toObject(), ...data.inspection };
    if (data.pricing) order.pricing = { ...order.pricing.toObject(), ...data.pricing };
    if (data.payment) order.payment = { ...order.payment.toObject(), ...data.payment };
    if (data.cancelReason) order.cancelReason = data.cancelReason;
    if (data.rejectReason) order.rejectReason = data.rejectReason;
    
    await order.save();
    return order;
  }
  
  /**
   * 提交报价
   */
  static async submitQuote(id, quoteData) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (order.status !== 'Inspecting') throw new BadRequestError('当前状态无法报价');
    
    order.pricing.quotedPrice = quoteData.quotedPrice;
    order.pricing.finalPrice = order.calculateFinalPrice();
    order.inspection.report = quoteData.report;
    order.inspection.images = quoteData.images || [];
    order.inspection.status = 'passed';
    order.inspection.inspectedAt = new Date();
    order.inspection.inspectedBy = quoteData.inspectedBy;
    order.status = 'Quoted';
    
    await order.save();
    return order;
  }
  
  /**
   * 接受报价
   */
  static async acceptQuote(id, userId) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法接受');
    
    order.status = 'Accepted';
    await order.save();
    return order;
  }
  
  /**
   * 拒绝报价
   */
  static async rejectQuote(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法拒绝');
    
    order.status = 'Rejected';
    order.rejectReason = reason;
    
    // 退还优惠券
    if (order.coupon?.id) {
      await Coupon.findByIdAndUpdate(order.coupon.id, {
        $inc: { usedCount: -1 },
        $pull: { userClaims: { orderId: order._id } }
      });
    }
    
    await order.save();
    return order;
  }
  
  /**
   * 取消订单
   */
  static async cancelOrder(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作');
    if (!['Submitted', 'Shipping'].includes(order.status)) throw new BadRequestError('当前状态无法取消');
    
    order.status = 'Cancelled';
    order.cancelReason = reason;
    
    // 退还优惠券
    if (order.coupon?.id) {
      await Coupon.findByIdAndUpdate(order.coupon.id, {
        $inc: { usedCount: -1 },
        $pull: { userClaims: { orderId: order._id } }
      });
    }
    
    await order.save();
    return order;
  }
  
  /**
   * 确认打款
   */
  static async confirmPayment(id, paymentData) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (order.status !== 'Accepted') throw new BadRequestError('当前状态无法打款');
    
    order.payment.paidAt = new Date();
    order.payment.transactionId = paymentData.transactionId;
    order.status = 'Completed';
    
    await order.save();
    return order;
  }
}

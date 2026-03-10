// src/modules/orders/order.service.js
import mongoose from 'mongoose';
import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import Warehouse from '../warehouses/warehouse.model.js';
import Coupon from '../coupons/coupon.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class OrderService {
  
  static generateOrderNumber() {
    return Order.generateOrderNumber();
  }

  static async createOrder(userId, orderData) {
    console.log('[OrderService] 📝 创建回收订单...');
    
    const { jobId, productInfo, shippingMethod, warehouse, pickupInfo, payment, couponId } = orderData;
    
    const job = await Job.findById(jobId);
    if (!job) throw new NotFoundError('商品不存在');
    if (job.status !== 'active') throw new BadRequestError('该商品暂不支持回收');
    
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    const orderNumber = Order.generateOrderNumber();
    
    let basePrice = job.estimatedPrice || job.pricing?.basePrice || 0;
    let conditionRate = 1;
    
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
    
    const finalPrice = Math.max(0, estimatedPrice - couponDiscount);
    
    const order = await Order.create({
      orderNumber,
      userId,
      jobId,
      status: 'Submitted',
      orderType: 'recycle',
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
    
    await Job.findByIdAndUpdate(jobId, { 
      $inc: { 'stats.recycleCount': 1, appliedCount: 1 } 
    });
    
    console.log('[OrderService] ✅ 订单创建成功:', orderNumber);
    return order;
  }
  
  static async getUserOrders(userId, query = {}) {
    const filter = { userId, orderType: 'recycle' };
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
  
  // 获取用户回寄订单
  static async getUserReturnOrders(userId, query = {}) {
    const filter = { 
      userId, 
      status: { $in: ['Rejected', 'Returning', 'ReturnConfirmed'] }
    };
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
    const filter = { orderType: 'recycle' };
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
  
  // 获取所有回寄订单（管理员）
  static async getAllReturnOrders(query = {}) {
    const filter = { 
      status: { $in: ['Rejected', 'Returning', 'ReturnConfirmed'] }
    };
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
  
  static async updateShipping(id, userId, shippingData) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    if (String(order.userId) !== String(userId)) {
      throw new BadRequestError('无权操作此订单');
    }
    
    if (!['Submitted', 'Shipping'].includes(order.status)) {
      throw new BadRequestError('当前状态无法填写物流信息');
    }
    
    const { expressCompany, trackingNumber } = shippingData;
    
    if (!trackingNumber) {
      throw new BadRequestError('请填写快递单号');
    }
    
    order.shipping.expressCompany = expressCompany;
    order.shipping.trackingNumber = trackingNumber;
    order.shipping.shippedAt = new Date();
    order.status = 'Shipping';
    order.timeline.shippedAt = new Date();
    
    await order.save();
    return order;
  }
  
  static async confirmReceive(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    if (order.status !== 'Shipping') {
      throw new BadRequestError('当前状态无法确认收货');
    }
    
    order.status = 'Received';
    order.shipping.receivedAt = new Date();
    order.timeline.receivedAt = new Date();
    
    await order.save();
    return order;
  }
  
  static async updateStatus(id, status, data = {}) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    order.status = status;
    
    const now = new Date();
    switch(status) {
      case 'Shipping': order.timeline.shippedAt = now; break;
      case 'Received': order.timeline.receivedAt = now; break;
      case 'Inspecting': order.timeline.inspectingAt = now; break;
      case 'Quoted': order.timeline.quotedAt = now; break;
      case 'Accepted': order.timeline.acceptedAt = now; break;
      case 'Rejected': order.timeline.rejectedAt = now; break;
      case 'Returning': order.timeline.returningAt = now; break;
      case 'ReturnConfirmed': order.timeline.returnConfirmedAt = now; break;
      case 'Completed': order.timeline.completedAt = now; break;
      case 'Cancelled': order.timeline.cancelledAt = now; break;
    }
    
    if (data.shipping) order.shipping = { ...order.shipping.toObject(), ...data.shipping };
    if (data.returnShipping) order.returnShipping = { ...order.returnShipping?.toObject() || {}, ...data.returnShipping };
    if (data.inspection) order.inspection = { ...order.inspection.toObject(), ...data.inspection };
    if (data.pricing) order.pricing = { ...order.pricing.toObject(), ...data.pricing };
    if (data.payment) order.payment = { ...order.payment.toObject(), ...data.payment };
    if (data.cancelReason) order.cancelReason = data.cancelReason;
    if (data.rejectReason) order.rejectReason = data.rejectReason;
    
    await order.save();
    return order;
  }
  
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
    order.timeline.quotedAt = new Date();
    
    await order.save();
    return order;
  }
  
  static async acceptQuote(id, userId) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法接受');
    
    order.status = 'Accepted';
    order.timeline.acceptedAt = new Date();
    await order.save();
    return order;
  }
  
  static async rejectQuote(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法拒绝');
    
    order.status = 'Rejected';
    order.rejectReason = reason;
    order.timeline.rejectedAt = new Date();
    order.orderType = 'return';
    
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
  
  // 安排回寄（管理员）
  static async arrangeReturn(id, returnData) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    if (order.status !== 'Rejected') {
      throw new BadRequestError('当前状态无法安排回寄');
    }
    
    const { expressCompany, trackingNumber, notes } = returnData;
    
    if (!trackingNumber) {
      throw new BadRequestError('请填写回寄快递单号');
    }
    
    order.returnShipping = {
      expressCompany,
      trackingNumber,
      notes,
    };
    order.status = 'Returning';
    order.orderType = 'return';
    order.timeline.returningAt = new Date();
    
    await order.save();
    return order;
  }
  
  // 确认回寄发出（管理员）
  static async confirmReturnShipped(id) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    if (order.status !== 'Returning') {
      throw new BadRequestError('当前状态无法确认发出');
    }
    
    if (!order.returnShipping?.trackingNumber) {
      throw new BadRequestError('请先填写回寄快递信息');
    }
    
    order.returnShipping.shippedAt = new Date();
    
    await order.save();
    return order;
  }
  
  // 确认回寄收货（用户）
  static async confirmReturnReceived(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('订单ID无效');
    }
    
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    if (String(order.userId) !== String(userId)) {
      throw new BadRequestError('无权操作此订单');
    }
    
    if (order.status !== 'Returning') {
      throw new BadRequestError('当前状态无法确认收货');
    }
    
    order.status = 'ReturnConfirmed';
    order.returnShipping.receivedAt = new Date();
    order.returnShipping.confirmedAt = new Date();
    order.timeline.returnConfirmedAt = new Date();
    
    await order.save();
    return order;
  }
  
  static async cancelOrder(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作');
    if (!['Submitted', 'Shipping'].includes(order.status)) throw new BadRequestError('当前状态无法取消');
    
    order.status = 'Cancelled';
    order.cancelReason = reason;
    order.timeline.cancelledAt = new Date();
    
    if (order.coupon?.id) {
      await Coupon.findByIdAndUpdate(order.coupon.id, {
        $inc: { usedCount: -1 },
        $pull: { userClaims: { orderId: order._id } }
      });
    }
    
    await order.save();
    return order;
  }
  
  static async confirmPayment(id, paymentData) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (order.status !== 'Accepted') throw new BadRequestError('当前状态无法打款');
    
    order.payment.paidAt = new Date();
    order.payment.transactionId = paymentData.transactionId;
    order.status = 'Completed';
    order.timeline.completedAt = new Date();
    
    await order.save();
    return order;
  }
}

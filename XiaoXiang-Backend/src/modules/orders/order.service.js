// src/modules/orders/order.service.js
// 回收订单服务（优化版）

import mongoose from 'mongoose';
import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import Warehouse from '../warehouses/warehouse.model.js';
import Coupon from '../coupons/coupon.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

export class OrderService {
  
  /**
   * 创建回收订单
   */
  static async createOrder(userId, orderData) {
    console.log('[OrderService] 📝 创建回收订单...');
    
    const { jobId, productInfo, shipping, payment, couponId, pickupInfo } = orderData;
    
    // 验证商品
    const job = await Job.findById(jobId);
    if (!job) throw new NotFoundError('商品不存在');
    if (job.status !== 'active') throw new BadRequestError('该商品暂不支持回收');
    if (job.isFrozen) throw new BadRequestError('该商品已被冻结');
    
    // 验证用户
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    // 生成订单号
    const orderNumber = Order.generateOrderNumber();
    
    // 计算预估价格
    let estimatedPrice = job.estimatedPrice || job.pricing?.basePrice || 0;
    if (productInfo?.condition && job.conditionPrices?.length > 0) {
      const conditionPrice = job.conditionPrices.find(cp => cp.condition === productInfo.condition);
      if (conditionPrice) {
        if (conditionPrice.price) {
          estimatedPrice = conditionPrice.price;
        } else if (conditionPrice.priceRate) {
          estimatedPrice = Math.floor((job.estimatedPrice || job.pricing.basePrice) * conditionPrice.priceRate);
        }
      }
    }
    
    // 处理优惠券
    let couponData = null;
    let couponDiscount = 0;
    if (couponId) {
      const coupon = await Coupon.findById(couponId);
      if (coupon) {
        const { canUse, reason } = coupon.canUse(userId, estimatedPrice);
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
        } else {
          console.log('[OrderService] ⚠️ 优惠券不可用:', reason);
        }
      }
    }
    
    // 获取仓库信息
    let warehouseData = null;
    if (shipping?.method === 'express' || shipping?.method === 'self') {
      // 快递寄送或自行送达，使用商品指定的仓库或默认仓库
      let warehouse = null;
      if (job.assignedWarehouse) {
        warehouse = await Warehouse.findById(job.assignedWarehouse);
      }
      if (!warehouse) {
        warehouse = await Warehouse.getDefault();
      }
      if (warehouse) {
        warehouseData = {
          id: warehouse._id,
          name: warehouse.name,
          address: warehouse.address?.detail,
          phone: warehouse.contact?.phone,
        };
      }
    } else if (shipping?.method === 'pickup') {
      // 上门回收，验证服务区域
      if (!pickupInfo?.address?.longitude || !pickupInfo?.address?.latitude) {
        throw new BadRequestError('上门回收需要提供位置信息');
      }
      
      const availableWarehouses = await Warehouse.checkPickupAvailability(
        pickupInfo.address.longitude,
        pickupInfo.address.latitude
      );
      
      if (availableWarehouses.length === 0) {
        throw new BadRequestError('您所在的区域暂不支持上门回收服务');
      }
      
      // 使用最近的仓库
      const nearestWarehouse = availableWarehouses[0];
      warehouseData = {
        id: nearestWarehouse._id,
        name: nearestWarehouse.name,
        address: nearestWarehouse.address?.detail,
        phone: nearestWarehouse.contact?.phone,
      };
    }
    
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
        categories: {
          l1: job.categoryL1 ? { id: job.categoryL1._id, name: job.categoryL1.name } : null,
          l2: job.categoryL2 ? { id: job.categoryL2._id, name: job.categoryL2.name } : null,
          l3: job.categoryL3 ? { id: job.categoryL3._id, name: job.categoryL3.name } : null,
        },
        pricing: job.pricing,
        estimatedPrice: job.estimatedPrice,
        estimatedPaymentHours: job.estimatedPaymentHours,
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
      pricing: { 
        estimatedPrice,
        couponDiscount,
      },
      coupon: couponData,
      shipping: {
        method: shipping?.method || 'express',
        userAddress: shipping?.userAddress,
      },
      pickupInfo: shipping?.method === 'pickup' ? {
        scheduledTime: pickupInfo?.scheduledTime,
        address: pickupInfo?.address,
        contactName: pickupInfo?.contactName,
        contactPhone: pickupInfo?.contactPhone,
        status: 'pending',
      } : undefined,
      payment: {
        method: payment?.method,
        account: payment?.account,
        accountName: payment?.accountName,
        bankName: payment?.bankName,
      },
      warehouse: warehouseData,
      confirmation: {
        condition: productInfo?.condition,
        description: productInfo?.description,
        shippingMethod: shipping?.method,
        estimatedPrice,
        estimatedPaymentTime: job.estimatedPaymentHours ? 
          new Date(Date.now() + job.estimatedPaymentHours * 60 * 60 * 1000) : null,
        couponApplied: !!couponData,
        confirmedAt: new Date(),
      },
      amount: estimatedPrice,
    });
    
    // 使用优惠券
    if (couponData) {
      await Coupon.findById(couponData.id).then(c => {
        if (c) {
          const userClaim = c.userClaims.find(
            uc => String(uc.userId) === String(userId) && !uc.usedAt
          );
          if (userClaim) {
            userClaim.usedAt = new Date();
            userClaim.orderId = order._id;
            c.usedCount += 1;
            return c.save();
          }
        }
      });
    }
    
    // 更新商品统计
    await Job.findByIdAndUpdate(jobId, { $inc: { 'stats.recycleCount': 1, appliedCount: 1 } });
    
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
        .populate('coupon.id', 'name code')
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
        .populate('coupon.id', 'name code')
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
      .populate('userId', 'nickname phone avatar')
      .populate('jobId')
      .populate('inspection.inspectedBy', 'nickname')
      .populate('warehouse.id')
      .populate('coupon.id');
    
    if (!order) throw new NotFoundError('订单不存在');
    return order;
  }
  
  /**
   * 更新订单状态
   */
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
    
    // 处理上门回收状态
    if (data.pickupInfo) {
      order.pickupInfo = { ...order.pickupInfo?.toObject(), ...data.pickupInfo };
    }
    
    await order.save();
    return order;
  }
  
  /**
   * 🆕 换绑仓库
   */
  static async changeWarehouse(id, newWarehouseId, reason, adminId) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    
    const newWarehouse = await Warehouse.findById(newWarehouseId);
    if (!newWarehouse) throw new NotFoundError('目标仓库不存在');
    
    // 检查是否需要换绑
    if (String(order.warehouse?.id) === String(newWarehouseId)) {
      throw new BadRequestError('订单已绑定该仓库');
    }
    
    // 执行换绑
    order.changeWarehouse(newWarehouse, reason, adminId);
    
    await order.save();
    console.log('[OrderService] 🏭 仓库换绑成功:', order.orderNumber);
    return order;
  }
  
  /**
   * 填写快递信息
   */
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
  
  /**
   * 提交报价
   */
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
    
    // 计算最终价格（含优惠券）
    order.pricing.finalPrice = order.calculateFinalPrice();
    
    await order.save();
    return order;
  }
  
  /**
   * 接受报价
   */
  static async acceptQuote(id, userId) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法接受报价');
    
    order.pricing.finalPrice = order.calculateFinalPrice();
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
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (order.status !== 'Quoted') throw new BadRequestError('当前状态无法拒绝报价');
    
    order.rejectReason = reason;
    order.status = 'Rejected';
    
    // 退还优惠券
    if (order.coupon?.id) {
      const coupon = await Coupon.findById(order.coupon.id);
      if (coupon) {
        const userClaim = coupon.userClaims.find(
          uc => String(uc.userId) === String(userId) && String(uc.orderId) === String(id)
        );
        if (userClaim) {
          userClaim.usedAt = null;
          userClaim.orderId = null;
          coupon.usedCount = Math.max(0, coupon.usedCount - 1);
          await coupon.save();
        }
      }
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
    order.payment.proof = paymentData.proof;
    order.payment.transactionId = paymentData.transactionId;
    order.status = 'Completed';
    
    await order.save();
    return order;
  }
  
  /**
   * 取消订单
   */
  static async cancelOrder(id, userId, reason) {
    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('订单不存在');
    if (String(order.userId) !== String(userId)) throw new BadRequestError('无权操作此订单');
    if (!['Submitted', 'Shipping'].includes(order.status)) throw new BadRequestError('当前状态无法取消');
    
    order.status = 'Cancelled';
    order.cancelReason = reason;
    
    // 退还优惠券
    if (order.coupon?.id) {
      const coupon = await Coupon.findById(order.coupon.id);
      if (coupon) {
        const userClaim = coupon.userClaims.find(
          uc => String(uc.userId) === String(userId) && String(uc.orderId) === String(id)
        );
        if (userClaim) {
          userClaim.usedAt = null;
          userClaim.orderId = null;
          coupon.usedCount = Math.max(0, coupon.usedCount - 1);
          await coupon.save();
        }
      }
    }
    
    await order.save();
    return order;
  }
  
  /**
   * 获取订单统计
   */
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
    
    // 优惠券使用统计
    const couponStats = await Order.aggregate([
      { $match: { ...matchStage, 'coupon.id': { $exists: true } } },
      { $group: { 
        _id: null, 
        ordersWithCoupon: { $sum: 1 }, 
        totalCouponDiscount: { $sum: '$coupon.discountAmount' } 
      }},
    ]);
    
    return { 
      byStatus: stats, 
      total: totalStats[0] || { totalOrders: 0, totalAmount: 0 },
      couponUsage: couponStats[0] || { ordersWithCoupon: 0, totalCouponDiscount: 0 },
    };
  }
}

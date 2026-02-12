import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import { UserService } from '../users/user.service.js';
import { NotFoundError, BadRequestError, TooManyRequestsError } from '../../common/utils/error.js';

export class OrderService {
  /**
   * 用户接单
   */
  static async applyForJob(userId, jobId, levelIndex = 0) {
    const job = await Job.findById(jobId)
      .populate('categoryL1', 'name color')
      .populate('categoryL2', 'name color')
      .populate('categoryL3', 'name color');
    const user = await User.findById(userId);

    if (!job) throw new NotFoundError('任务不存在');
    if (!user) throw new NotFoundError('用户不存在');

    const now = new Date();

    if (job.isFrozen) throw new BadRequestError('任务已冻结');
    if (job.isLimitedTime && job.endAt && now > new Date(job.endAt)) throw new BadRequestError('该任务限时抢购已结束');
    if (job.appliedCount >= job.totalSlots) throw new BadRequestError('名额已满');

    if (job.kycRequired && user.kycStatus !== 'Verified') throw new BadRequestError('该任务需完成实名认证');
    if (job.depositRequirement && (user.deposit || 0) < job.depositRequirement) throw new BadRequestError('保证金不足，请前往个人中心缴纳');

    if (!job.isRepeatable) {
      const existingOrder = await Order.findOne({
        userId,
        jobId,
        status: { $nin: ['Cancelled', 'Rejected', 'Completed'] }
      });
      if (existingOrder) throw new BadRequestError('您已接过此任务');
    }

    let finalAmount = job.amount;
    let selectedLevel = '一级';

    if (job.amountLevels && job.amountLevels.length > 0) {
      const level = job.amountLevels[levelIndex] || job.amountLevels[0];
      finalAmount = level.amount;
      selectedLevel = level.level;
    }

    const order = await Order.create({
      userId,
      jobId,
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'Applied',
      jobSnapshot: {
        title: job.title,
        subtitle: job.subtitle,
        amount: finalAmount,
        deadline: job.deadline,
        categories: {
          l1: job.categoryL1 ? { id: job.categoryL1._id, name: job.categoryL1.name, color: job.categoryL1.color } : null,
          l2: job.categoryL2 ? { id: job.categoryL2._id, name: job.categoryL2.name, color: job.categoryL2.color } : null,
          l3: job.categoryL3 ? { id: job.categoryL3._id, name: job.categoryL3.name, color: job.categoryL3.color } : null
        },
        categoryName: selectedLevel
      }
    });

    await Job.findByIdAndUpdate(jobId, { $inc: { appliedCount: 1 } });
    return order;
  }

  /**
   * 用户提交订单（完成任务）
   * Applied → Submitted
   */
  static async submitOrder(orderId, userId, description, evidencePaths, userRole = 'user') {
    const order = await Order.findById(orderId).populate('userId');
    if (!order) throw new NotFoundError('订单不存在');

    const isOwner = order.userId._id.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) throw new BadRequestError('无权操作该订单');
    
    // 只有 Applied 状态的订单可以提交
    if (order.status !== 'Applied') {
      throw new BadRequestError('只有已接单的订单可以提交');
    }

    if (!isAdmin) {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const recentOrder = await Order.findOne({ 
        userId, 
        submittedAt: { $gte: oneMinuteAgo } 
      });
      if (recentOrder) throw new TooManyRequestsError('提交过于频繁，请1分钟后再试');
    }

    // 状态流转：Applied → Submitted
    order.description = description;
    order.evidence = evidencePaths;
    order.status = 'Submitted';
    await order.save();
    return order;
  }

  /**
   * 获取用户订单列表
   */
  static async getUserOrders(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const orders = await Order.find({ userId })
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Order.countDocuments({ userId });
    return { orders, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 获取所有订单（管理员）
   */
  static async getAllOrders(query = {}) {
    const { status, page = 1, limit = 20 } = query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;

    const orders = await Order.find(filter)
      .populate('userId', 'email name')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Order.countDocuments(filter);
    return { orders, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 获取单个订单详情
   */
  static async getOrderById(id) {
    const order = await Order.findById(id)
      .populate('userId', 'email name')
      .populate('jobId', 'title')
      .populate('reviewedBy', 'name email');
    if (!order) throw new NotFoundError('订单不存在');
    return order;
  }

  /**
   * 更新订单状态（带状态流转验证）
   * 支持的状态流转：
   * - Submitted → Reviewing (开始审核)
   * - Reviewing → PendingPayment (审核通过)
   * - Reviewing → Rejected (审核驳回)
   * - PendingPayment → Completed (完成打款)
   * - PendingPayment → Cancelled (管理员取消)
   * - 任意状态 → Cancelled (管理员可强制取消)
   */
  static async updateOrderStatus(orderId, status, options = {}) {
    const { reason = '', reviewedBy = null, paymentProof = '', paymentNote = '' } = options;
    
    const order = await this.getOrderById(orderId);
    
    // 验证状态值有效性
    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled', 'Rejected'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的订单状态');
    }

    // 定义状态流转规则
    const allowedTransitions = {
      'Applied': ['Submitted', 'Cancelled'],
      'Submitted': ['Reviewing', 'Cancelled'],
      'Reviewing': ['PendingPayment', 'Rejected'],
      'PendingPayment': ['Completed', 'Cancelled'],
      'Completed': [], // 完成后不能再更改
      'Cancelled': [], // 取消后不能再更改
      'Rejected': []   // 驳回后不能再更改
    };

    // 检查状态流转是否允许
    const allowedNextStatuses = allowedTransitions[order.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      throw new BadRequestError(`状态流转错误：不能从 ${order.status} 转换到 ${status}`);
    }

    // 根据状态处理特殊逻辑
    switch (status) {
      case 'Completed':
        // 打款逻辑
        if (order.status !== 'Completed') {
          const amount = order.jobSnapshot.amount;
          console.log(`[OrderService] 触发打款: 订单 ${orderId}, 金额 ¥${amount}`);

          try {
            // 1. 给做单用户发工资
            await UserService.addBalance(order.userId._id, amount, order._id, '兼职任务佣金发放');
            await UserService.addExpAndCredit(order.userId._id, amount, 1);
            
            // 👇 2. 【新增核心逻辑】触发团长系统佣金计算与人数更新
            // 逻辑：判断用户是否为有效好友 -> 计算佣金 -> 发放给上级 -> 更新上级人数统计
            await UserService.processOrderCommission(order.userId._id, order._id, amount);
            
            order.paymentProof = paymentProof;
            order.paymentNote = paymentNote;
          } catch (balanceErr) {
            console.error('[OrderService] 加款失败:', balanceErr);
            throw new BadRequestError('加款失败: ' + balanceErr.message);
          }
        }
        break;

      case 'Rejected':
        // 记录驳回原因
        if (reason) order.rejectReason = reason;
        if (reviewedBy) order.reviewedBy = reviewedBy;
        break;

      case 'Cancelled':
        // 记录取消原因
        if (reason) order.cancelReason = reason;
        break;

      case 'Reviewing':
        // 记录审核人
        if (reviewedBy) order.reviewedBy = reviewedBy;
        break;
    }

    // 更新状态
    order.status = status;
    await order.save();
    
    return await this.getOrderById(orderId);
  }

  /**
   * 取消订单
   */
  static async cancelOrder(orderId, userId, userRole = 'user', reason = '') {
    const order = await this.getOrderById(orderId);
    const isOwner = order.userId._id.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) throw new BadRequestError('无权操作该订单');
    
    // 用户只能取消 Applied 状态的订单
    if (!isAdmin && order.status !== 'Applied') {
      throw new BadRequestError('只有未提交的订单可以取消');
    }

    // 管理员可以取消任何非最终状态的订单
    const finalStatuses = ['Completed', 'Cancelled', 'Rejected'];
    if (isAdmin && finalStatuses.includes(order.status)) {
      throw new BadRequestError('已完成或已取消的订单不能再次取消');
    }

    // 更新订单状态
    order.status = 'Cancelled';
    if (reason) order.cancelReason = reason;
    await order.save();

    // 如果是用户自己取消，扣除信用分
    if (!isAdmin) {
      await UserService.modifyCreditScore(userId, -1);
    }

    return order;
  }

  /**
   * 批量更新订单状态（管理员）
   */
  static async bulkUpdateOrderStatus(orderIds, status, options = {}) {
    const { reason = '', reviewedBy = null } = options;
    
    const results = [];
    const errors = [];
    
    for (const orderId of orderIds) {
      try {
        const order = await this.updateOrderStatus(orderId, status, { reason, reviewedBy });
        results.push(order);
      } catch (error) {
        errors.push({
          orderId,
          error: error.message
        });
      }
    }
    
    return {
      success: results,
      failed: errors,
      total: orderIds.length,
      successCount: results.length,
      failedCount: errors.length
    };
  }

  /**
   * 获取订单统计信息（管理员）
   */
  static async getOrderStats(timeRange = 'today') {
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const stats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$jobSnapshot.amount' }
        }
      }
    ]);

    // 格式化统计结果
    const formattedStats = {};
    let totalOrders = 0;
    let totalAmount = 0;

    stats.forEach(stat => {
      formattedStats[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount
      };
      totalOrders += stat.count;
      totalAmount += stat.totalAmount;
    });

    // 确保所有状态都有值
    const allStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled', 'Rejected'];
    allStatuses.forEach(status => {
      if (!formattedStats[status]) {
        formattedStats[status] = { count: 0, amount: 0 };
      }
    });

    return {
      timeRange,
      startDate,
      endDate: now,
      stats: formattedStats,
      totalOrders,
      totalAmount
    };
  }
}

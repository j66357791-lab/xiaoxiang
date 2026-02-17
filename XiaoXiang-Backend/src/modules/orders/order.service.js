import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import { UserService } from '../users/user.service.js';
import { NotFoundError, BadRequestError, TooManyRequestsError } from '../../common/utils/error.js';
import { sendPushNotification } from '../../common/utils/push.js';

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

    if (user.pushToken) {
      sendPushNotification(
        user.pushToken,
        '接单成功',
        '亲爱的小象用户，恭喜您已经成功接单任务，可前往个人中心我的订单页面处进行查看。',
        { type: 'order', orderId: order._id.toString() }
      ).then(result => {
        if (result.success) {
          console.log(`[OrderService] 接单通知已发送给用户 ${userId}`);
        } else {
          console.log(`[OrderService] 接单通知发送失败: ${result.error}`);
        }
      }).catch(err => {
        console.error('[OrderService] 推送异常:', err);
      });
    }

    return order;
  }

  /**
   * 用户提交订单（完成任务）
   */
  static async submitOrder(orderId, userId, description, evidencePaths, userRole = 'user') {
    console.log('[Service] submitOrder 开始执行');
    console.log('[Service] 参数:', { orderId, userId, userRole });

    const order = await Order.findById(orderId).populate('userId');
    
    console.log('[Service] 查询订单结果:', order ? '找到订单' : '订单不存在');
    
    if (!order) throw new NotFoundError('订单不存在');

    // 🔧 详细调试
    const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
    
    console.log('========================================');
    console.log('[Service] 权限对比详情:');
    console.log('  订单ID:', orderId);
    console.log('  订单所属用户ID (orderUserId):', orderUserId);
    console.log('  请求用户ID (userId):', userId);
    console.log('  userId type:', typeof userId);
    console.log('  order.userId 原始值:', order.userId);
    console.log('  order.userId._id:', order.userId?._id);
    console.log('  对比结果:', orderUserId === userId.toString());
    console.log('========================================');

    const isOwner = orderUserId === userId.toString();
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) {
      console.log('[Service] ❌ 权限验证失败!');
      throw new BadRequestError('无权操作该订单');
    }
    
    console.log('[Service] ✅ 权限验证通过');

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

    order.description = description;
    order.evidence = evidencePaths;
    order.status = 'Submitted';
    await order.save();
    
    console.log('[Service] 订单提交成功');
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
   * 更新订单状态
   */
  static async updateOrderStatus(orderId, status, options = {}) {
    const { reason = '', reviewedBy = null, paymentProof = '', paymentNote = '' } = options;
    
    const order = await this.getOrderById(orderId);
    
    const validStatuses = ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled', 'Rejected'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的订单状态');
    }

    const allowedTransitions = {
      'Applied': ['Submitted', 'Cancelled'],
      'Submitted': ['Reviewing', 'Cancelled'],
      'Reviewing': ['PendingPayment', 'Rejected'],
      'PendingPayment': ['Completed', 'Cancelled'],
      'Completed': [],
      'Cancelled': [],
      'Rejected': []
    };

    const allowedNextStatuses = allowedTransitions[order.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      throw new BadRequestError(`状态流转错误：不能从 ${order.status} 转换到 ${status}`);
    }

    switch (status) {
      case 'Completed':
        if (order.status !== 'Completed') {
          const amount = order.jobSnapshot.amount;
          console.log(`[OrderService] 触发打款: 订单 ${orderId}, 金额 ¥${amount}`);

          try {
            await UserService.addBalance(order.userId._id, amount, order._id, '兼职任务佣金发放');
            await UserService.addExpAndCredit(order.userId._id, amount, 1);
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
        if (reason) order.rejectReason = reason;
        if (reviewedBy) order.reviewedBy = reviewedBy;
        break;

      case 'Cancelled':
        if (reason) order.cancelReason = reason;
        break;

      case 'Reviewing':
        if (reviewedBy) order.reviewedBy = reviewedBy;
        break;
    }

    order.status = status;
    await order.save();
    
    return await this.getOrderById(orderId);
  }

  /**
   * 取消订单
   */
  static async cancelOrder(orderId, userId, userRole = 'user', reason = '') {
    const order = await this.getOrderById(orderId);
    
    const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
    const isOwner = orderUserId === userId.toString();
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) throw new BadRequestError('无权操作该订单');
    
    if (!isAdmin && order.status !== 'Applied') {
      throw new BadRequestError('只有未提交的订单可以取消');
    }

    const finalStatuses = ['Completed', 'Cancelled', 'Rejected'];
    if (isAdmin && finalStatuses.includes(order.status)) {
      throw new BadRequestError('已完成或已取消的订单不能再次取消');
    }

    order.status = 'Cancelled';
    if (reason) order.cancelReason = reason;
    await order.save();

    if (!isAdmin) {
      await UserService.modifyCreditScore(userId, -1);
    }

    return order;
  }

  /**
   * 批量更新订单状态
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
   * 获取订单统计信息
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

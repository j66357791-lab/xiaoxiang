import Order from './order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import { UserService } from '../users/user.service.js';
import { NotFoundError, BadRequestError, TooManyRequestsError } from '../../common/utils/error.js';
import { ORDER_STATUS } from '../../common/config/constants.js';

export class OrderService {
  /**
   * 用户接单
   */
  static async applyForJob(userId, jobId, levelIndex = 0) {
    // 1. 查询任务和用户
    const job = await Job.findById(jobId);
    const user = await User.findById(userId);

    if (!job) throw new NotFoundError('任务不存在');
    if (!user) throw new NotFoundError('用户不存在');

    // 2. 业务校验
    if (job.isFrozen) throw new BadRequestError('任务已冻结');
    if (job.appliedCount >= job.totalSlots) throw new BadRequestError('名额已满');

    // 3. 校验保证金
    if (job.depositRequirement && (user.deposit || 0) < job.depositRequirement) {
      throw new BadRequestError('保证金不足，请前往个人中心缴纳');
    }

    // 4. 校验实名认证
    if (job.kycRequired && user.kycStatus !== 'Verified') {
      throw new BadRequestError('该任务需完成实名认证');
    }

    // 5. 检查是否已接单
    const existingOrder = await Order.findOne({
      userId,
      jobId,
      status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED, ORDER_STATUS.COMPLETED] }
    });
    if (existingOrder) throw new BadRequestError('您已接过此任务');

    // 6. 阶梯价格计算
    let finalAmount = job.amount;
    let selectedLevel = '一级';

    if (job.amountLevels && job.amountLevels.length > 0) {
      const level = job.amountLevels[levelIndex] || job.amountLevels[0];
      finalAmount = level.amount;
      selectedLevel = level.level;
    }

    // 7. 创建订单
    const order = await Order.create({
      userId,
      jobId,
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: ORDER_STATUS.APPLIED,
      jobSnapshot: {
        title: job.title,
        amount: finalAmount,
        categoryName: selectedLevel
      }
    });

    // 8. 增加任务计数
    await Job.findByIdAndUpdate(jobId, { $inc: { appliedCount:1 } });

    return order;
  }

  /**
   * 提交订单
   */
  static async submitOrder(orderId, userId, description, evidencePaths) {
    const order = await Order.findById(orderId).populate('userId');
    if (!order) throw new NotFoundError('订单不存在');

    // 权限检查
    if (order.userId._id.toString() !== userId) {
      throw new BadRequestError('无权操作该订单');
    }

    // 状态检查
    if (order.status !== ORDER_STATUS.APPLIED) {
      throw new BadRequestError('当前状态不允许提交');
    }

    // 1分钟冷却
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentOrder = await Order.findOne({
      userId,
      submittedAt: { $gte: oneMinuteAgo }
    });

    if (recentOrder) {
      throw new TooManyRequestsError('提交过于频繁，请1分钟后再试');
    }

    // 自动状态判断
    const newStatus = (description?.trim() && evidencePaths.length > 0)
      ? ORDER_STATUS.REVIEWING
      : ORDER_STATUS.SUBMITTED;

    order.description = description;
    order.evidence = evidencePaths;
    order.status = newStatus;

    await order.save();
    return order;
  }

  /**
   * 获取用户的订单
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
      .populate('jobId', 'title');
    if (!order) throw new NotFoundError('订单不存在');
    return order;
  }

  /**
   * 更新订单状态（管理员）
   */
  static async updateOrderStatus(orderId, status) {
    const order = await this.getOrderById(orderId);
    const validStatuses = Object.values(ORDER_STATUS);

    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的订单状态');
    }

    // 确认打款逻辑
    if (status === ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.COMPLETED) {
      const amount = order.jobSnapshot.amount;
      console.log(`[OrderService] 触发打款: 订单 ${orderId}, 金额 ¥${amount}`);

      try {
        // 1. 加款
        await UserService.addBalance(order.userId._id, amount, order._id, '兼职任务佣金发放');
        
        // 2. 👇 新增：增加经验值和信誉分 (经验 = 2 + 金额, 信誉 +1)
        await UserService.addExpAndCredit(order.userId._id, amount, 1);
        
        // 3. 👇 (可选) 如果是VIP订单，记录到 vipEarningsSum，用于后续回本逻辑
        // if (order.isVipExclusive) {
        //   await User.findByIdAndUpdate(order.userId._id, { $inc: { vipEarningsSum: amount } });
        // }

      } catch (balanceErr) {
        console.error('[OrderService] 加款失败:', balanceErr);
        throw new BadRequestError('加款失败: ' + balanceErr.message);
      }
    }

    order.status = status;
    await order.save();

    return await this.getOrderById(orderId);
  }

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @param {string} userId - 当前操作用户ID
   * @param {string} userRole - 当前操作用户角色 (admin/superAdmin)
   */
  static async cancelOrder(orderId, userId, userRole = 'user') {
    const order = await this.getOrderById(orderId);

    // 👇 权限校验：订单本人 OR 管理员
    const isOwner = order.userId._id.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) {
      throw new BadRequestError('无权操作该订单');
    }

    // 状态校验
    // 普通用户：只能取消 'Applied' (已接单但未提交) 状态
    // 管理员：可以取消任意状态的订单 (强制取消)
    if (order.status !== ORDER_STATUS.APPLIED) {
      if (!isAdmin) {
        throw new BadRequestError('只有未提交的订单可以取消');
      }
      // 管理员允许继续操作，不做状态拦截
    }

    order.status = ORDER_STATUS.CANCELLED;
    await order.save();

    // 扣除信誉分
    // 普通用户取消扣分，管理员后台操作通常不扣分
    if (!isAdmin) {
      await UserService.modifyCreditScore(userId, -1);
    }

    return order;
  }
}

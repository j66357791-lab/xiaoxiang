import Order from '../order.model.js';
import Job from '../jobs/job.model.js';
import User from '../users/user.model.js';
import { UserService } from '../users/user.service.js';
import { NotFoundError, BadRequestError, TooManyRequestsError } from '../../common/utils/error.js';
import { ORDER_STATUS } from '../../common/config/constants.js';

export class OrderService {
  /**
   * 用户接单 (已重构以支持三级分类、限时抢购、重复接单校验)
   */
  static async applyForJob(userId, jobId, levelIndex = 0) {
    // 1. 查询任务 (Populate 三级分类，以便保存快照)
    const job = await Job.findById(jobId)
      .populate('categoryL1', 'name color')
      .populate('categoryL2', 'name color')
      .populate('categoryL3', 'name color');
    const user = await User.findById(userId);

    if (!job) throw new NotFoundError('任务不存在');
    if (!user) throw new NotFoundError('用户不存在');

    const now = new Date();

    // 2. 业务校验
    
    // 校验：任务是否冻结
    if (job.isFrozen) throw new BadRequestError('该任务已冻结，无法接单');

    // 👇 新增校验：限时抢购是否结束
    if (job.isLimitedTime && job.endAt) {
      if (now > new Date(job.endAt)) {
        throw new BadRequestError('该任务限时抢购已结束');
      }
    }

    // 校验：名额是否已满
    if (job.appliedCount >= job.totalSlots) throw new BadRequestError('名额已满');

    // 校验：实名认证
    if (job.kycRequired && user.kycStatus !== 'Verified') {
      throw new BadRequestError('该任务需完成实名认证');
    }

    // 校验：保证金
    if (job.depositRequirement && (user.deposit || 0) < job.depositRequirement) {
      throw new BadRequestError('保证金不足，请前往个人中心缴纳');
    }

    // 👇 新增校验：是否允许重复接单
    // 如果 isRepeatable 为 false (默认)，则检查是否已存在有效订单
    if (!job.isRepeatable) {
      const existingOrder = await Order.findOne({
        userId,
        jobId,
        status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED, ORDER_STATUS.COMPLETED] }
      });
      if (existingOrder) throw new BadRequestError('您已接过此任务');
    }

    // 3. 阶梯价格计算
    let finalAmount = job.amount;
    let selectedLevel = '一级';

    if (job.amountLevels && job.amountLevels.length > 0) {
      const level = job.amountLevels[levelIndex] || job.amountLevels[0];
      finalAmount = level.amount;
      selectedLevel = level.level;
    }

    // 4. 创建订单 (增强的快照逻辑)
    const order = await Order.create({
      userId,
      jobId,
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: ORDER_STATUS.APPLIED,
      jobSnapshot: {
        title: job.title,
        subtitle: job.subtitle, // 👈 保存小标题
        amount: finalAmount,
        deadline: job.deadline,
        // 👈 保存三级分类完整信息 (ID + Name)，防止分类被删导致历史数据丢失
        categories: {
          l1: job.categoryL1 ? { id: job.categoryL1._id, name: job.categoryL1.name, color: job.categoryL1.color } : null,
          l2: job.categoryL2 ? { id: job.categoryL2._id, name: job.categoryL2.name, color: job.categoryL2.color } : null,
          l3: job.categoryL3 ? { id: job.categoryL3._id, name: job.categoryL3.name, color: job.categoryL3.color } : null,
        }
      }
    });

    // 5. 增加任务计数
    await Job.findByIdAndUpdate(jobId, { $inc: { appliedCount:1 } });

    return order;
  }

  /**
   * 提交订单
   */
  static async submitOrder(orderId, userId, description, evidencePaths, userRole = 'user') {
    const order = await Order.findById(orderId).populate('userId');
    if (!order) throw new NotFoundError('订单不存在');

    const isOwner = order.userId._id.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) throw new BadRequestError('无权操作该订单');

    if (order.status !== ORDER_STATUS.APPLIED) {
      throw new BadRequestError('当前状态不允许提交');
    }

    if (!isAdmin) {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const recentOrder = await Order.findOne({ userId, submittedAt: { $gte: oneMinuteAgo } });
      if (recentOrder) throw new TooManyRequestsError('提交过于频繁，请1分钟后再试');
    }

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
      .populate('jobId', 'title') // 这里的 populate 主要是为了兼容，主要数据在 snapshot
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
   * 更新订单状态（管理员）- 包含经验值和信誉分更新
   */
  static async updateOrderStatus(orderId, status) {
    const order = await this.getOrderById(orderId);
    const validStatuses = Object.values(ORDER_STATUS);

    if (!validStatuses.includes(status)) throw new BadRequestError('无效的订单状态');

    if (status === ORDER_STATUS.COMPLETED && order.status !== ORDER_STATUS.COMPLETED) {
      const amount = order.jobSnapshot.amount;
      console.log(`[OrderService] 触发打款: 订单 ${orderId}, 金额 ¥${amount}`);

      try {
        // 1. 加款
        await UserService.addBalance(order.userId._id, amount, order._id, '兼职任务佣金发放');
        // 2. 增加经验值和信誉分
        await UserService.addExpAndCredit(order.userId._id, amount, 1);
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
   */
  static async cancelOrder(orderId, userId, userRole = 'user') {
    const order = await this.getOrderById(orderId);
    const isOwner = order.userId._id.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'superAdmin';

    if (!isOwner && !isAdmin) throw new BadRequestError('无权操作该订单');

    if (order.status !== ORDER_STATUS.APPLIED) {
      if (!isAdmin) throw new BadRequestError('只有未提交的订单可以取消');
    }

    order.status = ORDER_STATUS.CANCELLED;
    await order.save();

    if (!isAdmin) {
      await UserService.modifyCreditScore(userId, -1);
    }

    return order;
  }
}

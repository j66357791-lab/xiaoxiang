import mongoose from 'mongoose';
import Job from './job.model.js';
import User from '../users/user.model.js';
import Order from '../orders/order.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

// 简单的订单号生成器
const generateOrderNumber = () => {
  return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
};

export class JobService {
  /**
   * 获取所有任务（仅限已发布）
   */
  static async getAllJobs() {
    return await Job.find({ 
      isPublished: true, 
      isFrozen: false 
    })
      .populate('categoryL1', 'name color')
      .populate('categoryL2', 'name color')
      .populate('categoryL3', 'name color')
      .sort({ createdAt: -1 });
  }

  /**
   * 根据 ID 获取任务详情
   */
  static async getJobById(id) {
    const job = await Job.findById(id)
      .populate('categoryL1', 'name color')
      .populate('categoryL2', 'name color')
      .populate('categoryL3', 'name color');
    if (!job) throw new NotFoundError('任务不存在');
    return job;
  }

  /**
   * 用户接单核心逻辑 (已集成：三级分类、限时抢购、重复接单校验)
   */
  static async applyJob(jobId, userId, levelIndex = null) {
    // 1. 查询任务 (Populate 三级分类，以便保存快照)
    const job = await this.getJobById(jobId);
    const user = await User.findById(userId);

    if (!user) throw new BadRequestError('用户不存在');

    const now = new Date();

    // 2. 业务校验
    
    // 校验：任务是否冻结
    if (job.isFrozen) throw new BadRequestError('该任务已冻结，无法接单');

    // 👇 新增校验：是否已发布 (防止未到定时发布时间却直接通过ID接单)
    if (!job.isPublished) throw new BadRequestError('该任务暂未发布');

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
      throw new BadRequestError(`接单需缴纳 ¥${job.depositRequirement} 保证金`);
    }

    // 👇 新增校验：是否允许重复接单
    // 如果 isRepeatable 为 false (默认)，则检查是否已存在有效订单
    if (!job.isRepeatable) {
      const existingOrder = await Order.findOne({ 
        jobId, 
        userId,
        status: { $nin: ['Cancelled', 'Rejected', 'Completed'] }
      });
      if (existingOrder) throw new BadRequestError('您已接过此任务');
    }

    // 3. 计算最终金额（处理阶梯价格）
    let finalAmount = job.amount;
    let selectedLevel = '默认等级'; // 快照中存储的等级名称

    if (levelIndex !== null && job.amountLevels && job.amountLevels[levelIndex]) {
      const level = job.amountLevels[levelIndex];
      finalAmount = level.amount;
      selectedLevel = level.level;
    }

    // 4. 创建订单
    // 👇 增强的快照逻辑：保存三级分类完整信息、副标题
    const orderData = {
      orderNumber: generateOrderNumber(),
      userId: userId,
      jobId: jobId,
      amount: parseFloat(finalAmount),
      status: 'Applied', // 初始状态：已接单
      jobSnapshot: {
        title: job.title,
        subtitle: job.subtitle, // 👈 新增：保存副标题
        amount: finalAmount,
        deadline: job.deadline,
        // 👈 新增：保存三级分类完整信息 (ID + Name)，防止分类被删导致历史数据丢失
        categories: {
          l1: job.categoryL1 ? { id: job.categoryL1._id, name: job.categoryL1.name, color: job.categoryL1.color } : null,
          l2: job.categoryL2 ? { id: job.categoryL2._id, name: job.categoryL2.name, color: job.categoryL2.color } : null,
          l3: job.categoryL3 ? { id: job.categoryL3._id, name: job.categoryL3.name, color: job.categoryL3.color } : null,
        },
        categoryName: selectedLevel // 兼容旧版，记录所选阶梯名称
      }
    };

    const newOrder = await Order.create(orderData);

    // 5. 更新任务接单人数
    await this.incrementAppliedCount(jobId);

    return newOrder;
  }

  /**
   * 创建任务（管理员）- 已集成三级分类、定时发布、限时抢购
   */
  static async createJob(jobData) {
    const {
      title, subtitle, content, 
      category1, category2, category3, // 👈 新增：三级分类ID
      amount, totalSlots, authorId, deadlineHours, 
      scheduledAt, endAt, // 👈 新增：定时发布、限时结束
      type, amountLevels, steps, contentImages,
      depositRequirement, kycRequired,
      isRepeatable // 👈 新增：是否可重复
    } = jobData;

    // 解析可能为字符串的数组
    const parsedAmountLevels = typeof amountLevels === 'string' ? JSON.parse(amountLevels) : amountLevels || [];
    const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps || [];
    const finalAmount = amount || (parsedAmountLevels.length > 0 ? parsedAmountLevels[0].amount : 0);

    if (!title || !content || !finalAmount || !totalSlots || !deadlineHours) {
      throw new BadRequestError('参数不完整');
    }

    // 处理定时发布逻辑
    const now = new Date();
    const isPublished = scheduledAt ? new Date(scheduledAt) <= now : true;

    // 计算截止时间 (deadlineHours 为数字)
    const deadline = new Date(now.getTime() + parseInt(deadlineHours) * 60 * 60 * 1000);

    const job = await Job.create({
      title: title.trim(),
      subtitle: subtitle?.trim(), // 👈 新增
      content: content.trim(),
      categoryL1: category1 || null,
      categoryL2: category2 || null,
      categoryL3: category3 || null,
      type: type || 'single',
      amount: parseFloat(finalAmount),
      totalSlots: parseInt(totalSlots),
      author: authorId || null,
      deadline,
      deadlineHours: parseInt(deadlineHours),
      depositRequirement: depositRequirement || 0,
      kycRequired: kycRequired || false,
      isFrozen: false,
      isPublished, // 👈 新增
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null, // 👈 新增
      endAt: endAt ? new Date(endAt) : null, // 👈 新增
      isLimitedTime: !!endAt, // 👈 新增：如果设置了 endAt，自动标记为限时
      isRepeatable: isRepeatable || false, // 👈 新增
      contentImages: Array.isArray(contentImages) ? contentImages : [],
      steps: parsedSteps,
      amountLevels: parsedAmountLevels
    });

    return job;
  }

  /**
   * 冻结/解冻任务
   */
  static async toggleFreeze(id) {
    const job = await this.getJobById(id);
    job.isFrozen = !job.isFrozen;
    await job.save();
    return job;
  }

  /**
   * 删除任务
   */
  static async deleteJob(id) {
    const job = await this.getJobById(id);
    await Job.findByIdAndDelete(id);
    return job;
  }

  /**
   * 增加任务接单计数
   */
  static async incrementAppliedCount(jobId) {
    await Job.findByIdAndUpdate(jobId, { $inc: { appliedCount: 1 } });
  }

  /**
   * 检查并冻结过期任务 / 发布定时任务 (定时任务调用)
   */
  static async checkDeadlines() {
    return await Job.checkStatuses();
  }
}

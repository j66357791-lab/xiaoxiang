import mongoose from 'mongoose';
// 请确保以下三个模型文件存在于对应路径
import Job from './job.model.js'; 
import User from '../users/user.model.js'; 
import Order from '../orders/order.model.js'; 
// 请确保 error.js 存在于 src/common/utils/error.js
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

// 订单号生成器
const generateOrderNumber = () => 'ORD' + Date.now() + Math.floor(Math.random() * 1000);

// 👇 这里必须要有 export 关键字
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
   * 用户接单核心逻辑
   */
  static async applyJob(jobId, userId, levelIndex = null) {
    // 1. 查询数据
    const job = await this.getJobById(jobId);
    const user = await User.findById(userId);

    if (!user) throw new BadRequestError('用户不存在');

    const now = new Date();

    // 2. 业务校验
    if (job.isFrozen) throw new BadRequestError('该任务已冻结，无法接单');
    if (!job.isPublished) throw new BadRequestError('该任务暂未发布');
    
    if (job.isLimitedTime && job.endAt) {
      if (now > new Date(job.endAt)) throw new BadRequestError('该任务限时抢购已结束');
    }

    if (job.appliedCount >= job.totalSlots) throw new BadRequestError('名额已满');

    if (job.kycRequired && user.kycStatus !== 'Verified') {
      throw new BadRequestError('该任务需完成实名认证');
    }

    if (job.depositRequirement && (user.deposit || 0) < job.depositRequirement) {
      throw new BadRequestError(`接单需缴纳 ¥${job.depositRequirement} 保证金`);
    }

    // 检查重复接单
    if (!job.isRepeatable) {
      const existingOrder = await Order.findOne({
        jobId,
        userId,
        // 注意：状态必须完全匹配 order.model.js 中的枚举 (PascalCase)
        status: { $nin: ['Cancelled', 'Rejected', 'Completed'] }
      });
      if (existingOrder) throw new BadRequestError('您已接过此任务');
    }

    // 计算金额
    let finalAmount = job.amount;
    let selectedLevel = '默认等级';

    if (levelIndex !== null && job.amountLevels && job.amountLevels[levelIndex]) {
      const level = job.amountLevels[levelIndex];
      finalAmount = level.amount;
      selectedLevel = level.level;
    }

    // 创建订单
    const orderData = {
      orderNumber: generateOrderNumber(),
      userId: userId,
      jobId: jobId,
      amount: parseFloat(finalAmount),
      // 状态必须匹配 model 枚举
      status: 'Applied', 
      jobSnapshot: {
        title: job.title,
        subtitle: job.subtitle,
        amount: finalAmount,
        deadline: job.deadline,
        categories: {
          l1: job.categoryL1 ? { id: job.categoryL1._id, name: job.categoryL1.name, color: job.categoryL1.color } : null,
          l2: job.categoryL2 ? { id: job.categoryL2._id, name: job.categoryL2.name, color: job.categoryL2.color } : null,
          l3: job.categoryL3 ? { id: job.categoryL3._id, name: job.categoryL3.name, color: job.categoryL3.color } : null,
        },
        categoryName: selectedLevel
      }
    };

    const newOrder = await Order.create(orderData);
    await this.incrementAppliedCount(jobId);

    return newOrder;
  }

  /**
   * 创建任务（管理员）
   */
  static async createJob(jobData) {
    const {
      title, subtitle, content, 
      category1, category2, category3, 
      amount, totalSlots, authorId, deadlineHours, 
      scheduledAt, endAt, 
      type, amountLevels, steps, contentImages,
      depositRequirement, kycRequired,
      isRepeatable 
    } = jobData;

    // 解析数组
    const parsedAmountLevels = typeof amountLevels === 'string' ? JSON.parse(amountLevels) : amountLevels || [];
    const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps || [];
    const finalAmount = amount || (parsedAmountLevels.length > 0 ? parsedAmountLevels[0].amount : 0);

    if (!title || !content || !finalAmount || !totalSlots || !deadlineHours) {
      throw new BadRequestError('参数不完整');
    }

    const now = new Date();
    const isPublished = scheduledAt ? new Date(scheduledAt) <= now : true;
    const deadline = new Date(now.getTime() + parseInt(deadlineHours) * 60 * 60 * 1000);

    const job = await Job.create({
      title: title.trim(),
      subtitle: subtitle?.trim(),
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
      isPublished,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      isLimitedTime: !!endAt,
      isRepeatable: isRepeatable || false,
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
    await Job.findByIdAndUpdate(jobId, { $inc: { appliedCount:1 } });
  }

  /**
   * 检查并冻结过期任务
   */
  static async checkDeadlines() {
    return await Job.checkStatuses();
  }
}

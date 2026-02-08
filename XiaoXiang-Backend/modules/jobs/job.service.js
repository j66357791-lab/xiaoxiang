import mongoose from 'mongoose';
import Job from './job.model.js';
import User from '../users/user.model.js';
import Order from '../orders/order.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

const generateOrderNumber = () => 'ORD' + Date.now() + Math.floor(Math.random() * 1000);

export class JobService {
  static async getAllJobs() {
    return await Job.find({ isPublished: true, isFrozen: false })
      .populate('categoryL1', 'name color')
      .populate('categoryL2', 'name color')
      .populate('categoryL3', 'name color')
      .sort({ createdAt: -1 });
  }

  static async getJobById(id) {
    const job = await Job.findById(id)
      .populate('categoryL1', 'name color')
      .populate('categoryL2', 'name color')
      .populate('categoryL3', 'name color');
    if (!job) throw new NotFoundError('任务不存在');
    return job;
  }

  static async applyJob(jobId, userId, levelIndex = null) {
    const job = await this.getJobById(jobId);
    const user = await User.findById(userId);
    if (!user) throw new BadRequestError('用户不存在');

    const now = new Date();

    if (job.isFrozen) throw new BadRequestError('该任务已冻结，无法接单');
    if (!job.isPublished) throw new BadRequestError('该任务暂未发布');
    if (job.isLimitedTime && job.endAt && now > new Date(job.endAt)) throw new BadRequestError('该任务限时抢购已结束');
    if (job.appliedCount >= job.totalSlots) throw new BadRequestError('名额已满');
    if (job.kycRequired && user.kycStatus !== 'Verified') throw new BadRequestError('该任务需完成实名认证');
    if (job.depositRequirement && (user.deposit || 0) < job.depositRequirement) throw new BadRequestError(`接单需缴纳 ¥${job.depositRequirement} 保证金`);

    if (!job.isRepeatable) {
      const existingOrder = await Order.findOne({
        jobId,
        userId,
        status: { $nin: ['Cancelled', 'Rejected', 'Completed'] }
      });
      if (existingOrder) throw new BadRequestError('您已接过此任务');
    }

    let finalAmount = job.amount;
    let selectedLevel = '默认等级';

    if (levelIndex !== null && job.amountLevels && job.amountLevels[levelIndex]) {
      const level = job.amountLevels[levelIndex];
      finalAmount = level.amount;
      selectedLevel = level.level;
    }

    const orderData = {
      orderNumber: generateOrderNumber(),
      userId,
      jobId,
      amount: parseFloat(finalAmount),
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
    };

    const newOrder = await Order.create(orderData);
    await this.incrementAppliedCount(jobId);

    return newOrder;
  }

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

    const parsedAmountLevels = typeof amountLevels === 'string' ? JSON.parse(amountLevels) : amountLevels || [];
    const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps || [];
    const finalAmount = amount || (parsedAmountLevels.length > 0 ? parsedAmountLevels[0].amount : 0);

    if (!title || !content || !finalAmount || !totalSlots || !deadlineHours) throw new BadRequestError('参数不完整');

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

  static async toggleFreeze(id) {
    const job = await this.getJobById(id);
    job.isFrozen = !job.isFrozen;
    await job.save();
    return job;
  }

  static async deleteJob(id) {
    const job = await this.getJobById(id);
    await Job.findByIdAndDelete(id);
    return job;
  }

  static async incrementAppliedCount(jobId) {
    await Job.findByIdAndUpdate(jobId, { $inc: { appliedCount: 1 } });
  }

  static async checkDeadlines() {
    return await Job.checkStatuses();
  }
}

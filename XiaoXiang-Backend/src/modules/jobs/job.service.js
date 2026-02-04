import mongoose from 'mongoose'; // 👈 引入 mongoose
import Job from './job.model.js';
import User from '../users/user.model.js'; // 👈 引入 User 模型
import Order from '../orders/order.model.js'; // 👈 引入 Order 模型
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

// 简单的订单号生成器
const generateOrderNumber = () => {
  return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
};

export class JobService {
  /**
   * 获取所有任务
   */
  static async getAllJobs() {
    return await Job.find().populate('category', 'name color').sort({ createdAt: -1 });
  }

  /**
   * 根据 ID 获取任务
   */
  static async getJobById(id) {
    const job = await Job.findById(id).populate('category', 'name color');
    if (!job) throw new NotFoundError('任务不存在');
    return job;
  }

  /**
   * 👇 新增：用户接单核心逻辑
   */
  static async applyJob(jobId, userId, levelIndex = null) {
    // 1. 查询任务
    const job = await this.getJobById(jobId);

    // 2. 查询用户
    const user = await User.findById(userId);
    if (!user) {
      throw new BadRequestError('用户不存在');
    }

    // 3. 业务校验
    
    // 校验：任务是否冻结
    if (job.isFrozen) {
      throw new BadRequestError('该任务已冻结，无法接单');
    }

    // 校验：名额是否已满
    if (job.appliedCount >= job.totalSlots) {
      throw new BadRequestError('抱歉，该任务名额已满');
    }

    // 校验：实名认证
    if (job.kycRequired && user.kycStatus !== 'Verified') {
      throw new BadRequestError('该任务需要完成实名认证后才能接单');
    }

    // 校验：保证金
    if (job.depositRequirement && (user.deposit || 0) < job.depositRequirement) {
      throw new BadRequestError(`接单需缴纳 ¥${job.depositRequirement} 保证金，请先充值`);
    }

    // 校验：重复接单
    const existingOrder = await Order.findOne({ jobId, userId });
    if (existingOrder) {
      throw new BadRequestError('您已经接过这个任务了，请勿重复接单');
    }

    // 4. 计算最终金额（处理阶梯价格）
    let finalAmount = job.amount;
    if (levelIndex !== null && job.amountLevels && job.amountLevels[levelIndex]) {
      finalAmount = job.amountLevels[levelIndex].amount;
    }

    // 5. 创建订单
    const orderData = {
      orderNumber: generateOrderNumber(),
      userId: userId,
      jobId: jobId,
      amount: parseFloat(finalAmount),
      status: 'Applied', // 初始状态：已接单
      jobSnapshot: {
        title: job.title,
        amount: finalAmount,
        deadline: job.deadline
      }
    };

    const newOrder = await Order.create(orderData);

    // 6. 更新任务接单人数
    await this.incrementAppliedCount(jobId);

    return newOrder;
  }

  /**
   * 创建任务（管理员）
   */
  static async createJob(jobData) {
    const {
      title, content, categoryId, amount, totalSlots,
      authorId, deadlineHours, type, amountLevels, steps, contentImages,
      depositRequirement, kycRequired
    } = jobData;

    // 解析可能为字符串的数组
    const parsedAmountLevels = typeof amountLevels === 'string' ? JSON.parse(amountLevels) : amountLevels || [];
    const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps || [];
    const finalAmount = amount || (parsedAmountLevels.length > 0 ? parsedAmountLevels[0].amount : 0);

    if (!title || !content || !categoryId || !finalAmount || !totalSlots || !deadlineHours) {
      throw new BadRequestError('参数不完整');
    }

    const deadline = new Date(Date.now() + parseInt(deadlineHours) * 60 * 60 * 1000);

    const job = await Job.create({
      title: title.trim(),
      content: content.trim(),
      category: categoryId,
      type: type || 'single',
      amount: parseFloat(finalAmount),
      totalSlots: parseInt(totalSlots),
      author: authorId || null,
      deadline,
      deadlineHours: parseInt(deadlineHours),
      depositRequirement: depositRequirement || 0,
      kycRequired: kycRequired || false,
      isFrozen: false,
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
   * 检查并冻结过期任务
   */
  static async checkDeadlines() {
    return await Job.checkDeadlines();
  }
}

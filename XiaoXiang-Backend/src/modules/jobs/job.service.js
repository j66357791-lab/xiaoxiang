import Job from './job.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';

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

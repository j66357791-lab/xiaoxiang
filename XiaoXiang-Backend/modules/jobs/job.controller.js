import { success, paginated } from '../../common/utils/response.js';
import { JobService } from './job.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class JobController {
  /**
   * 获取所有任务
   */
  static getAllJobs = asyncHandler(async (req, res) => {
    // 👇 前端可能需要分页，保留原有结构或改为 paginated
    const jobs = await JobService.getAllJobs();
    return success(res, jobs);
  });

  /**
   * 获取单个任务
   */
  static getJobById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const job = await JobService.getJobById(id);
    return success(res, job);
  });

  /**
   * 创建任务（管理员）
   */
  static createJob = asyncHandler(async (req, res) => {
    // 这里会自动提取 req.body 中的新字段
    const job = await JobService.createJob(req.body);
    return success(res, job, '任务创建成功', 201);
  });

  /**
   * 冻结/解冻任务（管理员）
   */
  static toggleFreeze = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const job = await JobService.toggleFreeze(id);
    return success(res, job);
  });

  /**
   * 删除任务（管理员）
   */
  static deleteJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await JobService.deleteJob(id);
    return success(res, null, '任务已删除');
  });

  /**
   * 用户接单
   */
  static applyJob = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.body.userId;
    const { jobId, levelIndex } = req.body;

    const order = await JobService.applyJob(jobId, userId, levelIndex);
    
    return success(res, order, '接单成功', 201);
  });
}

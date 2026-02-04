import { success, paginated } from '../../common/utils/response.js';
import { JobService } from './job.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class JobController {
  /**
   * 获取所有任务
   */
  static getAllJobs = asyncHandler(async (req, res) => {
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
}

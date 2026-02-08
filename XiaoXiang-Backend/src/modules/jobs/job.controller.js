import { success, paginated } from '../../common/utils/response.js';
import { JobService } from './job.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class JobController {
  static getAllJobs = asyncHandler(async (req, res) => {
    const jobs = await JobService.getAllJobs();
    return success(res, jobs);
  });

  static getJobById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const job = await JobService.getJobById(id);
    return success(res, job);
  });

  static createJob = asyncHandler(async (req, res) => {
    const job = await JobService.createJob(req.body);
    return success(res, job, '任务创建成功', 201);
  });

  static toggleFreeze = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const job = await JobService.toggleFreeze(id);
    return success(res, job);
  });

  static deleteJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await JobService.deleteJob(id);
    return success(res, null, '任务已删除');
  });

  static applyJob = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.body.userId;
    const { jobId, levelIndex } = req.body;

    const order = await JobService.applyJob(jobId, userId, levelIndex);
    return success(res, order, '接单成功', 201);
  });
}

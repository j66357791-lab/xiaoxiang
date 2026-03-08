// src/modules/jobs/job.controller.js

import { success, paginated } from '../../common/utils/response.js';
import { JobService } from './job.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class JobController {
  
  static getAllJobs = asyncHandler(async (req, res) => {
    console.log('[JobController] 📡 获取回收商品列表');
    const result = await JobService.getAllJobs(req.query || {});
    return paginated(res, result.jobs, result.pagination);
  });
  
  static getJobById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[JobController] 📡 获取商品详情:', id);
    const job = await JobService.getJobById(id);
    return success(res, job);
  });
  
  static createJob = asyncHandler(async (req, res) => {
    console.log('[JobController] 🚀 创建回收商品...');
    const jobData = { ...req.body, authorId: req.user?._id };
    const job = await JobService.createJob(jobData);
    console.log('[JobController] ✅ 创建成功');
    return success(res, job, '创建成功', 201);
  });
  
  static updateJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[JobController] 📝 更新商品:', id);
    const job = await JobService.updateJob(id, req.body || {});
    return success(res, job, '更新成功');
  });
  
  static deleteJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[JobController] 🗑️ 删除商品:', id);
    await JobService.deleteJob(id);
    return success(res, null, '删除成功');
  });
  
  static toggleFreeze = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isFrozen } = req.body || {};
    console.log('[JobController] ❄️ 冻结状态切换:', id);
    const job = await JobService.toggleFreeze(id, isFrozen);
    return success(res, job, job.isFrozen ? '已冻结' : '已解冻');
  });
  
  static getJobsByCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { limit } = req.query;
    const jobs = await JobService.getJobsByCategory(categoryId, limit);
    return success(res, jobs);
  });
}

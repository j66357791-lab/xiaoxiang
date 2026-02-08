import { success } from '../../common/utils/response.js';
import { JobService } from './job.service.js';

export class JobController {
  static getAllJobs = async (req, res, next) => {
    try {
      console.log('[JobController] 📡 获取任务列表');
      const jobs = await JobService.getAllJobs();
      return success(res, jobs);
    } catch (error) {
      next(error); // 👈 手动传递给 Express 错误处理中间件
    }
  };

  static getJobById = async (req, res, next) => {
    try {
      const { id } = req.params;
      console.log('[JobController] 📡 获取任务详情:', id);
      const job = await JobService.getJobById(id);
      return success(res, job);
    } catch (error) {
      next(error);
    }
  };

  static createJob = async (req, res, next) => {
    try {
      console.log('[JobController] 🚀 开始创建任务...');
      console.log('[JobController] 📥 请求体 Body:', JSON.stringify(req.body).substring(0, 200) + '...');
      
      // 👇 直接调用 Service，如果出错会被 catch 捕获
      const job = await JobService.createJob(req.body);
      
      console.log('[JobController] ✅ 任务创建成功');
      return success(res, job, '任务创建成功', 201);
    } catch (error) {
      console.error('[JobController] ❌ 创建任务出错:', error.message);
      next(error); // 👈 手动传递错误
    }
  };

  static toggleFreeze = async (req, res, next) => {
    try {
      const { id } = req.params;
      console.log('[JobController] ❄️ 冻结/解冻任务:', id);
      const job = await JobService.toggleFreeze(id);
      return success(res, job);
    } catch (error) {
      next(error);
    }
  };

  static deleteJob = async (req, res, next) => {
    try {
      const { id } = req.params;
      console.log('[JobController] 🗑️ 删除任务:', id);
      await JobService.deleteJob(id);
      return success(res, null, '任务已删除');
    } catch (error) {
      next(error);
    }
  };

  static applyJob = async (req, res, next) => {
    try {
      console.log('[JobController] 🤝 用户接单');
      const userId = req.user?._id || req.body.userId;
      const { jobId, levelIndex } = req.body;
      const order = await JobService.applyJob(jobId, userId, levelIndex);
      return success(res, order, '接单成功', 201);
    } catch (error) {
      next(error);
    }
  };
}

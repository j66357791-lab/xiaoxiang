import { success } from '../../common/utils/response.js';
import { JobService } from './job.service.js';

export class JobController {
  static getAllJobs = async (req, res) => {
    console.log('[JobController] 📡 获取任务列表');
    const jobs = await JobService.getAllJobs();
    return success(res, jobs);
  };

  static getJobById = async (req, res) => {
    const { id } = req.params;
    console.log('[JobController] 📡 获取任务详情:', id);
    const job = await JobService.getJobById(id);
    return success(res, job);
  };

  static createJob = async (req, res) => {
    // 👇 新增：打印请求体，方便调试
    console.log('[JobController] 🚀 开始创建任务...');
    console.log('[JobController] 📥 请求体 Body:', JSON.stringify(req.body).substring(0, 200) + '...');
    
    const job = await JobService.createJob(req.body);
    console.log('[JobController] ✅ 任务创建成功');
    return success(res, job, '任务创建成功', 201);
  };

  static toggleFreeze = async (req, res) => {
    const { id } = req.params;
    console.log('[JobController] ❄️ 冻结/解冻任务:', id);
    const job = await JobService.toggleFreeze(id);
    return success(res, job);
  };

  static deleteJob = async (req, res) => {
    const { id } = req.params;
    console.log('[JobController] 🗑️ 删除任务:', id);
    await JobService.deleteJob(id);
    return success(res, null, '任务已删除');
  };

  static applyJob = async (req, res) => {
    console.log('[JobController] 🤝 用户接单');
    const userId = req.user?._id || req.body.userId;
    const { jobId, levelIndex } = req.body;
    const order = await JobService.applyJob(jobId, userId, levelIndex);
    return success(res, order, '接单成功', 201);
  };
}

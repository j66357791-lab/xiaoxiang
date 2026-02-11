import { success } from '../../common/utils/response.js';
import { JobService } from './job.service.js';

export class JobController {
  static getAllJobs = async (req, res) => {
    try {
      console.log('[JobController] 📡 获取任务列表');
      const jobs = await JobService.getAllJobs();
      return success(res, jobs);
    } catch (error) {
      console.error('[JobController] ❌ 获取任务失败:', error);
      // 👇 直接返回错误响应，不使用 next
      return res.status(500).json({ success: false, message: error.message || '服务器内部错误' });
    }
  };

  static getJobById = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('[JobController] 📡 获取任务详情:', id);
      const job = await JobService.getJobById(id);
      return success(res, job);
    } catch (error) {
      console.error('[JobController] ❌ 获取详情失败:', error);
      return res.status(error.status || 500).json({ success: false, message: error.message || '服务器内部错误' });
    }
  };

  static createJob = async (req, res) => {
    try {
      console.log('[JobController] 🚀 开始创建任务...');
      console.log('[JobController] 📥 请求体 Body:', JSON.stringify(req.body).substring(0, 200) + '...');
      
      const job = await JobService.createJob(req.body);
      console.log('[JobController] ✅ 任务创建成功');
      
      return success(res, job, '任务创建成功', 201);
    } catch (error) {
      console.error('[JobController] ❌ 创建任务失败:', error);
      // 👇 关键：直接返回错误响应，而不是 next(error)
      // 这里如果是 ValidationError 或 BadRequestError，通常状态码是 400
      const statusCode = error.status || (error.name === 'ValidationError' ? 400 : 500);
      return res.status(statusCode).json({ success: false, message: error.message || '任务创建失败' });
    }
  };

  static toggleFreeze = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('[JobController] ❄️ 冻结/解冻任务:', id);
      const job = await JobService.toggleFreeze(id);
      return success(res, job);
    } catch (error) {
      console.error('[JobController] ❌ 冻结操作失败:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  static deleteJob = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('[JobController] 🗑️ 删除任务:', id);
      await JobService.deleteJob(id);
      return success(res, null, '任务已删除');
    } catch (error) {
      console.error('[JobController] ❌ 删除任务失败:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  static applyJob = async (req, res) => {
    try {
      console.log('[JobController] 🤝 用户接单');
      const userId = req.user?._id || req.body.userId;
      const { jobId, levelIndex } = req.body;
      const order = await JobService.applyJob(jobId, userId, levelIndex);
      return success(res, order, '接单成功', 201);
    } catch (error) {
      console.error('[JobController] ❌ 接单失败:', error);
      return res.status(error.status || 500).json({ success: false, message: error.message || '接单失败' });
    }
  };
}

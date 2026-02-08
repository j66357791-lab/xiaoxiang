import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { JobController } from './job.controller.js';
import { jobValidators } from './job.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 公开接口
// =====================

// 获取所有任务
router.get('/', asyncHandler(JobController.getAllJobs));

// 获取单个任务
router.get('/:id', asyncHandler(JobController.getJobById));

// 👇 新增：用户接单接口 (需要登录)
router.post('/apply',
  authenticate, // 👈 必须认证
  asyncHandler(JobController.applyJob)
);

// =====================
// 管理员接口
// =====================

// 创建任务
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(jobValidators.createJob),
  asyncHandler(JobController.createJob)
);

// 冻结/解冻任务
router.patch('/freeze/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(JobController.toggleFreeze)
);

// 删除任务
router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(JobController.deleteJob)
);

export default router;

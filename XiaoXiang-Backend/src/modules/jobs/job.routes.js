import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { JobController } from './job.controller.js';
import { jobValidators } from './job.validator.js';

const router = Router();

// =====================
// 公开路由
// =====================

// 获取任务列表
router.get('/', JobController.getAllJobs);

// 获取任务详情
router.get('/:id', JobController.getJobById);

// =====================
// 需要认证的路由
// =====================

// 接单
router.post('/apply',
  authenticate,
  JobController.applyJob
);

// =====================
// 管理员路由
// =====================

// 创建任务
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(jobValidators.createJob),
  JobController.createJob
);

// 👇👇👇 【新增】更新任务 👇👇👇
router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  JobController.updateJob
);
// 👆👆👆 【新增结束】👆👆👆

// 冻结/解冻任务
router.patch('/freeze/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  JobController.toggleFreeze
);

// 删除任务
router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  JobController.deleteJob
);

export default router;

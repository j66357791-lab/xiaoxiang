import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { JobController } from './job.controller.js';
import { jobValidators } from './job.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// 公开路由（不需要认证）
router.get('/', asyncHandler(JobController.getAllJobs));
router.get('/:id', asyncHandler(JobController.getJobById));

// 需要认证的路由
router.post('/apply',
  authenticate,
  asyncHandler(JobController.applyJob)
);

// 管理员路由
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(jobValidators.createJob),
  asyncHandler(JobController.createJob)
);

router.patch('/freeze/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(JobController.toggleFreeze)
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(JobController.deleteJob)
);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { JobController } from './job.controller.js';
import { jobValidators } from './job.validator.js';
// 👇 这里不再需要导入 asyncHandler

const router = Router();

// 公开路由
router.get('/', JobController.getAllJobs);
router.get('/:id', JobController.getJobById);

// 需要认证的路由
router.post('/apply',
  authenticate,
  JobController.applyJob
);

// 管理员路由
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  validate(jobValidators.createJob),
  JobController.createJob
);

router.patch('/freeze/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  JobController.toggleFreeze
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  JobController.deleteJob
);

export default router;

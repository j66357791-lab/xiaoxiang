// src/modules/jobs/job.routes.js

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { JobController } from './job.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ==================== 公开接口 ====================
router.get('/', asyncHandler(JobController.getAllJobs));
router.get('/category/:categoryId', asyncHandler(JobController.getJobsByCategory));
router.get('/:id', asyncHandler(JobController.getJobById));

// ==================== 管理员接口 ====================
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(JobController.createJob)
);

router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(JobController.updateJob)
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

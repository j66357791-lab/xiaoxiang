import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { TaskTypeController } from './taskType.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// 公开接口
router.get('/', asyncHandler(TaskTypeController.getAllTaskTypes));

// 管理员接口
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(TaskTypeController.createTaskType)
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(TaskTypeController.deleteTaskType)
);

export default router;

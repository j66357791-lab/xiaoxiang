import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { CategoryController } from './category.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// 公开接口
router.get('/', asyncHandler(CategoryController.getAllCategories));

// 👈 新增：兼容前端 /api/admin/categories 请求
router.get('/admin/categories', asyncHandler(CategoryController.getAllCategories));

// 管理员接口
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.createCategory)
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.deleteCategory)
);

export default router;

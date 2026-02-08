import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { CategoryController } from './category.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// 👇 新增：获取分类树形结构 (用于发布任务时的级联选择)
router.get('/tree', asyncHandler(CategoryController.getCategoryTree));

// 👇 保留：平铺列表 (用于简单展示)
router.get('/', asyncHandler(CategoryController.getAllCategories));

// 👇 兼容旧接口：管理员列表
router.get('/admin/categories', asyncHandler(CategoryController.getAllCategories));

// 👇 管理员接口：创建分类 (支持 parentId)
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.createCategory)
);

// 👇 管理员接口：删除分类
router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.deleteCategory)
);

export default router;

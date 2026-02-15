import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { CategoryController } from './category.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// =====================
// 公开接口（兼职大厅等用）
// =====================

// 获取分类树形结构
router.get('/tree', asyncHandler(CategoryController.getCategoryTree));

// 获取所有分类（平铺列表）
router.get('/', asyncHandler(CategoryController.getAllCategories));

// 获取单个分类
router.get('/:id', asyncHandler(CategoryController.getCategoryById));

// =====================
// 管理员接口
// =====================

// 创建分类
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.createCategory)
);

// 删除分类
router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.deleteCategory)
);

export default router;

// src/modules/categories/category.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { CategoryController } from './category.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ========== 公开接口 ==========

// 获取分类树（前端展示用）
router.get('/tree', 
  asyncHandler(CategoryController.getCategoryTree)
);

// 获取所有分类列表
router.get('/list',
  asyncHandler(CategoryController.getAllCategories)
);

// 🆕 获取一级分类
router.get('/level1',
  asyncHandler(CategoryController.getLevel1Categories)
);

// 🆕 获取子分类
router.get('/:id/children',
  asyncHandler(CategoryController.getSubCategories)
);

// 🆕 获取分类详情（含属性配置）
router.get('/:id',
  asyncHandler(CategoryController.getCategoryDetail)
);

// ========== 管理员接口 ==========

// 创建分类
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.createCategory)
);

// 更新分类
router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.updateCategory)
);

// 删除分类
router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.deleteCategory)
);

// 🆕 批量创建分类
router.post('/batch',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(CategoryController.batchCreateCategories)
);

export default router;

// src/modules/categories/category.controller.js
import { success } from '../../common/utils/response.js';
import { CategoryService } from './category.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class CategoryController {
  
  static getCategoryTree = asyncHandler(async (req, res) => {
    const tree = await CategoryService.getCategoryTree();
    return success(res, tree);
  });

  static getAllCategories = asyncHandler(async (req, res) => {
    const categories = await CategoryService.getAllCategories();
    return success(res, categories);
  });

  static getCategoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await CategoryService.getCategoryById(id);
    return success(res, category);
  });

  static createCategory = asyncHandler(async (req, res) => {
    const category = await CategoryService.createCategory(req.body);
    return success(res, category, '创建成功', 201);
  });

  // 🆕 更新分类
  static updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await CategoryService.updateCategory(id, req.body);
    return success(res, category, '更新成功');
  });

  static deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await CategoryService.deleteCategory(id);
    return success(res, null, '删除成功');
  });
}

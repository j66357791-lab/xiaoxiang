// src/modules/categories/category.controller.js
import { success } from '../../common/utils/response.js';
import { CategoryService } from './category.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class CategoryController {
  
  /**
   * 获取分类树
   */
  static getCategoryTree = asyncHandler(async (req, res) => {
    const tree = await CategoryService.getCategoryTree();
    return success(res, tree);
  });

  /**
   * 获取所有分类列表
   */
  static getAllCategories = asyncHandler(async (req, res) => {
    const categories = await CategoryService.getAllCategories();
    return success(res, categories);
  });

  /**
   * 🆕 获取一级分类
   */
  static getLevel1Categories = asyncHandler(async (req, res) => {
    const categories = await CategoryService.getLevel1Categories();
    return success(res, categories);
  });

  /**
   * 🆕 获取子分类
   */
  static getSubCategories = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const categories = await CategoryService.getSubCategories(id);
    return success(res, categories);
  });

  /**
   * 🆕 获取分类详情
   */
  static getCategoryDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await CategoryService.getCategoryWithAttributes(id);
    return success(res, category);
  });

  /**
   * 创建分类
   */
  static createCategory = asyncHandler(async (req, res) => {
    const category = await CategoryService.createCategory(req.body);
    return success(res, category, '创建成功', 201);
  });

  /**
   * 🆕 更新分类
   */
  static updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await CategoryService.updateCategory(id, req.body);
    return success(res, category, '更新成功');
  });

  /**
   * 删除分类
   */
  static deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await CategoryService.deleteCategory(id);
    return success(res, null, '删除成功');
  });

  /**
   * 🆕 批量创建分类
   */
  static batchCreateCategories = asyncHandler(async (req, res) => {
    const { categories } = req.body;
    const results = await CategoryService.batchCreateCategories(categories);
    return success(res, results, '批量创建完成');
  });
}

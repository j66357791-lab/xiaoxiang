import { success } from '../../common/utils/response.js';
import { CategoryService } from './category.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class CategoryController {
  /**
   * 获取所有分类
   */
  static getAllCategories = asyncHandler(async (req, res) => {
    const categories = await CategoryService.getAllCategories();
    return success(res, categories);
  });

  /**
   * 创建分类（管理员）
   */
  static createCategory = asyncHandler(async (req, res) => {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '分类名称不能为空'
      });
    }

    const category = await CategoryService.createCategory(name, color);
    return success(res, category, '创建成功', 201);
  });

  /**
   * 删除分类（管理员）
   */
  static deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await CategoryService.deleteCategory(id);
    return success(res, null, '删除成功');
  });
}

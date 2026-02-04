import Category from './category.model.js';
import { NotFoundError, ConflictError } from '../../common/utils/error.js';

export class CategoryService {
  /**
   * 获取所有分类
   */
  static async getAllCategories() {
    return await Category.find().sort({ createdAt: -1 });
  }

  /**
   * 根据 ID 获取分类
   */
  static async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');
    return category;
  }

  /**
   * 创建分类
   */
  static async createCategory(name, color) {
    // 检查是否已存在
    const existing = await Category.findOne({ name });
    if (existing) throw new ConflictError('分类名称已存在');

    const category = await Category.create({ name, color: color || '#4364F7' });
    return category;
  }

  /**
   * 更新分类
   */
  static async updateCategory(id, name, color) {
    const category = await this.getCategoryById(id);

    if (name) category.name = name;
    if (color) category.color = color;

    await category.save();
    return category;
  }

  /**
   * 删除分类
   */
  static async deleteCategory(id) {
    const category = await this.getCategoryById(id);
    await Category.findByIdAndDelete(id);
    return category;
  }
}

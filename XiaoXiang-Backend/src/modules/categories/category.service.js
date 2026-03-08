// src/modules/categories/category.service.js
import Category from './category.model.js';
import { NotFoundError, ConflictError } from '../../common/utils/error.js';

export class CategoryService {
  
  static async getAllCategories() {
    return await Category.find().sort({ level: 1, sort: 1, createdAt: 1 }).lean();
  }

  static async getCategoryTree() {
    const allCats = await Category.find().sort({ sort: 1, createdAt: 1 }).lean();

    const buildTree = (parentId = null) => {
      return allCats
        .filter(cat => String(cat.parentId) === String(parentId))
        .map(cat => ({
          ...cat,
          children: buildTree(cat._id),
        }));
    };

    return buildTree();
  }

  static async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');
    return category;
  }

  static async createCategory(data) {
    const { name, color, icon, parentId, sort, isActive } = data;

    // 检查同级是否已存在同名
    const existing = await Category.findOne({ name, parentId: parentId || null });
    if (existing) throw new ConflictError('该分类名称已存在');

    // 计算层级
    let level = 1;
    if (parentId) {
      const parent = await Category.findById(parentId);
      if (!parent) throw new NotFoundError('父级分类不存在');
      if (parent.level >= 3) throw new ConflictError('分类层级不能超过3级');
      level = parent.level + 1;
    }

    const category = await Category.create({
      name,
      color: color || '#4364F7',
      icon,
      parentId: parentId || null,
      level,
      sort: sort || 0,
      isActive: isActive ?? true,
    });

    return category;
  }

  static async updateCategory(id, data) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');

    const { name, color, icon, sort, isActive } = data;

    if (name !== undefined) category.name = name;
    if (color !== undefined) category.color = color;
    if (icon !== undefined) category.icon = icon;
    if (sort !== undefined) category.sort = sort;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    return category;
  }

  static async deleteCategory(id) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');

    const childrenCount = await Category.countDocuments({ parentId: id });
    if (childrenCount > 0) {
      throw new ConflictError('该分类下存在子分类，无法删除');
    }

    await Category.findByIdAndDelete(id);
    return category;
  }
}

// src/modules/categories/category.service.js
import Category from './category.model.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../common/utils/error.js';

export class CategoryService {
  
  /**
   * 获取所有分类（平铺列表）
   */
  static async getAllCategories() {
    return await Category.find()
      .sort({ level: 1, sort: 1, createdAt: 1 })
      .lean();
  }

  /**
   * 获取分类树结构
   */
  static async getCategoryTree() {
    const allCats = await Category.find()
      .sort({ level: 1, sort: 1 })
      .lean();

    // 构建树结构
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

  /**
   * 🆕 获取一级分类列表（带统计）
   */
  static async getLevel1Categories() {
    return await Category.find({ level: 1, isActive: true })
      .sort({ sort: 1 })
      .lean();
  }

  /**
   * 🆕 获取某分类的子分类
   */
  static async getSubCategories(parentId) {
    return await Category.find({ parentId, isActive: true })
      .sort({ sort: 1 })
      .lean();
  }

  /**
   * 🆕 获取分类详情（含属性配置）
   */
  static async getCategoryWithAttributes(id) {
    const category = await Category.findById(id).lean();
    if (!category) throw new NotFoundError('分类不存在');
    
    // 获取父级链
    const parentChain = [];
    let current = category;
    while (current.parentId) {
      const parent = await Category.findById(current.parentId).lean();
      if (parent) {
        parentChain.unshift(parent);
        current = parent;
      } else break;
    }
    
    return {
      ...category,
      parentChain,
    };
  }

  /**
   * 创建分类
   */
  static async createCategory(data) {
    const { name, parentId, level, attributes, ...rest } = data;

    // 检查同级是否已存在同名分类
    const existing = await Category.findOne({ name, parentId: parentId || null });
    if (existing) throw new ConflictError('该分类名称已存在');

    // 验证层级关系
    if (level === 1 && parentId) {
      throw new BadRequestError('一级分类不能有父级');
    }
    if (level > 1 && !parentId) {
      throw new BadRequestError('二级/三级分类必须指定父级');
    }
    if (parentId) {
      const parent = await Category.findById(parentId);
      if (!parent) throw new NotFoundError('父级分类不存在');
      if (parent.level !== level - 1) {
        throw new BadRequestError('父级分类层级不正确');
      }
    }

    const category = new Category({
      name,
      parentId: parentId || null,
      level,
      attributes: attributes || [],
      ...rest,
    });

    return await category.save();
  }

  /**
   * 🆕 更新分类（含属性配置）
   */
  static async updateCategory(id, data) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');

    const { name, color, icon, image, description, attributes, priceConfig, recycleConfig, isActive, sort } = data;

    if (name !== undefined) category.name = name;
    if (color !== undefined) category.color = color;
    if (icon !== undefined) category.icon = icon;
    if (image !== undefined) category.image = image;
    if (description !== undefined) category.description = description;
    if (attributes !== undefined) category.attributes = attributes;
    if (priceConfig !== undefined) category.priceConfig = { ...category.priceConfig, ...priceConfig };
    if (recycleConfig !== undefined) category.recycleConfig = { ...category.recycleConfig, ...recycleConfig };
    if (isActive !== undefined) category.isActive = isActive;
    if (sort !== undefined) category.sort = sort;

    return await category.save();
  }

  /**
   * 删除分类
   */
  static async deleteCategory(id) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');

    // 检查是否有子分类
    const childrenCount = await Category.countDocuments({ parentId: id });
    if (childrenCount > 0) {
      throw new ConflictError('该分类下存在子分类，无法删除，请先删除子分类');
    }

    await Category.findByIdAndDelete(id);
    return category;
  }

  /**
   * 🆕 批量创建分类（用于初始化数据）
   */
  static async batchCreateCategories(categories) {
    const results = [];
    for (const cat of categories) {
      try {
        const created = await this.createCategory(cat);
        results.push({ success: true, data: created });
      } catch (error) {
        results.push({ success: false, name: cat.name, error: error.message });
      }
    }
    return results;
  }
}

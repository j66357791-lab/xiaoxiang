import Category from './category.model.js';
import { NotFoundError, ConflictError } from '../../common/utils/error.js';

export class CategoryService {
  static async getAllCategories() {
    return await Category.find().sort({ createdAt: 1 });
  }

  static async getCategoryTree() {
    const allCats = await Category.find().sort({ createdAt: 1 });

    const buildTree = (parentId = null) => {
      const children = allCats.filter(c => {
        const pid = c.parentId ? c.parentId.toString() : null;
        return pid === parentId;
      });
      return children.map(c => ({
        ...c._doc,
        children: buildTree(c._id.toString())
      }));
    };

    return buildTree();
  }

  static async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) throw new NotFoundError('分类不存在');
    return category;
  }

  static async createCategory(name, color, parentId = null) {
    const existing = await Category.findOne({ name });
    if (existing) throw new ConflictError('分类名称已存在');

    let level = 1;

    if (parentId) {
      const parent = await Category.findById(parentId);
      if (!parent) throw new NotFoundError('父分类不存在');
      if (parent.level >= 3) throw new ConflictError('分类层级不能超过 3 级');
      level = parent.level + 1;
    }

    const category = await Category.create({ name, color: color || '#4364F7', parentId, level });
    return category;
  }

  static async updateCategory(id, name, color) {
    const category = await this.getCategoryById(id);
    if (name) category.name = name;
    if (color) category.color = color;
    await category.save();
    return category;
  }

  static async deleteCategory(id) {
    const category = await this.getCategoryById(id);
    const childrenCount = await Category.countDocuments({ parentId: id });
    if (childrenCount > 0) throw new ConflictError('该分类下存在子分类，无法删除，请先删除子分类');
    await Category.findByIdAndDelete(id);
    return category;
  }
}

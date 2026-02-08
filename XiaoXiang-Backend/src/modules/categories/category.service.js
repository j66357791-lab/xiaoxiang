import Category from './category.model.js';
import { NotFoundError, ConflictError } from '../../common/utils/error.js';

export class CategoryService {
  /**
   * 获取所有分类（平铺）
   */
  static async getAllCategories() {
    return await Category.find().sort({ createdAt: 1 });
  }

  /**
   * 获取分类树形结构（用于前端级联选择）
   */
  static async getCategoryTree() {
    const allCats = await Category.find().sort({ createdAt: 1 });
    
    // 递归构建树
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
  static async createCategory(name, color, parentId = null) {
    // 检查同名
    const existing = await Category.findOne({ name });
    if (existing) throw new ConflictError('分类名称已存在');

    let level = 1;
    
    // 如果有父级，校验并计算层级
    if (parentId) {
      const parent = await Category.findById(parentId);
      if (!parent) throw new NotFoundError('父分类不存在');
      
      // 限制最多 3 级
      if (parent.level >= 3) {
        throw new ConflictError('分类层级不能超过 3 级');
      }
      level = parent.level + 1;
    }

    const category = await Category.create({ name, color: color || '#4364F7', parentId, level });
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
   * 级联删除逻辑：如果有子分类，必须先删除子分类，或者实现级联删除（此处简单处理：有子则禁删）
   */
  static async deleteCategory(id) {
    const category = await this.getCategoryById(id);
    
    // 检查是否有子分类
    const childrenCount = await Category.countDocuments({ parentId: id });
    if (childrenCount > 0) {
      throw new ConflictError('该分类下存在子分类，无法删除，请先删除子分类');
    }

    await Category.findByIdAndDelete(id);
    return category;
  }
}

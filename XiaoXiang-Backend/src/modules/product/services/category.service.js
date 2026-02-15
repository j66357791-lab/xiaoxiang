// 导入时使用 ProductCategory 名称
import ProductCategory from '../models/category.model.js';

export const getCategories = async () => {
  return await ProductCategory.find({ isActive: true }).sort({ sort: 1 });
};

export const createCategory = async (data) => {
  const cat = new ProductCategory(data);
  await cat.save();
  return cat;
};

export const updateCategory = async (id, data) => {
  return await ProductCategory.findByIdAndUpdate(id, data, { new: true });
};

export const deleteCategory = async (id) => {
  // 软删除
  return await ProductCategory.findByIdAndUpdate(id, { isActive: false });
};

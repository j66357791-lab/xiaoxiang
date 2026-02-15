import Category from '../models/category.model.js';

export const getCategories = async () => {
  return await Category.find({ isActive: true }).sort({ sort: 1 });
};

export const createCategory = async (data) => {
  const cat = new Category(data);
  await cat.save();
  return cat;
};

export const updateCategory = async (id, data) => {
  return await Category.findByIdAndUpdate(id, data, { new: true });
};

export const deleteCategory = async (id) => {
  // 软删除
  return await Category.findByIdAndUpdate(id, { isActive: false });
};

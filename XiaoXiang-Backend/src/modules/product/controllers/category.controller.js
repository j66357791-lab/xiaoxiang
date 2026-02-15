import * as service from '../services/category.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const getCategories = asyncHandler(async (req, res) => {
  const data = await service.getCategories();
  return success(res, '获取成功', data);
});
export const createCategory = asyncHandler(async (req, res) => {
  const data = await service.createCategory(req.body);
  return success(res, '创建成功', data, 201);
});
export const updateCategory = asyncHandler(async (req, res) => {
  const data = await service.updateCategory(req.params.id, req.body);
  return success(res, '更新成功', data);
});
export const deleteCategory = asyncHandler(async (req, res) => {
  await service.deleteCategory(req.params.id);
  return success(res, '删除成功');
});

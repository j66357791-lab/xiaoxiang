import * as service from '../services/product.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

// 创建商品
export const createProduct = asyncHandler(async (req, res) => {
  const data = await service.createProduct(req.body, req.user);
  return success(res, '创建成功', data, 201);
});

// 更新商品
export const updateProduct = asyncHandler(async (req, res) => {
  const data = await service.updateProduct(req.params.id, req.body, req.user);
  return success(res, '更新成功', data);
});

// 获取商品列表
export const getProducts = asyncHandler(async (req, res) => {
  const data = await service.getProducts(req.query);
  return success(res, '获取成功', data);
});

// 获取单个商品
export const getProductById = asyncHandler(async (req, res) => {
  const data = await service.getProductById(req.params.id);
  return success(res, '获取成功', data);
});

// 调整库存
export const adjustStock = asyncHandler(async (req, res) => {
  const { newStock, reason } = req.body;
  const data = await service.adjustStock(req.params.id, newStock, reason, req.user);
  return success(res, '调整成功', data);
});

// 获取统计数据
export const getStats = asyncHandler(async (req, res) => {
  const data = await service.getStats();
  return success(res, '获取成功', data);
});

// 删除商品
export const deleteProduct = asyncHandler(async (req, res) => {
  const data = await service.deleteProduct(req.params.id);
  return success(res, '删除成功', data);
});

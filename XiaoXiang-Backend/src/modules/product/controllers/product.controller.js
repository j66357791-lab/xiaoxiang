import * as service from '../services/product.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const createProduct = asyncHandler(async (req, res) => {
  const data = await service.createProduct(req.body, req.user);
  return success(res, '创建成功', data, 201);
});

// 新增：更新商品（通用更新）
export const updateProduct = asyncHandler(async (req, res) => {
  const data = await service.updateProduct(req.params.id, req.body, req.user);
  return success(res, '更新成功', data);
});

// 保留：更新价格（兼容旧接口）
export const updateProductPrice = asyncHandler(async (req, res) => {
  const data = await service.updateProductPrice(req.params.id, req.body, req.user);
  return success(res, '更新成功', data);
});

export const getProducts = asyncHandler(async (req, res) => {
  const data = await service.getProducts(req.query);
  return success(res, '获取成功', data);
});

export const adjustStock = asyncHandler(async (req, res) => {
  const data = await service.adjustStock(req.params.id, req.body.newStock, req.body.reason, req.user);
  return success(res, '调整成功', data);
});

export const getStats = asyncHandler(async (req, res) => {
  const data = await service.getStockStats();
  return success(res, '获取成功', data[0] || {});
});

export const exportProducts = asyncHandler(async (req, res) => {
  const data = await service.exportProducts(req.query);
  return success(res, '导出数据准备完成', data);
});

import * as productService from '../services/product.service.js';
import { success } from '../../../common/utils/response.js';
import asyncHandler from '../../../common/utils/asyncHandler.js';

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body, req.user);
  // 注意：success 参数顺序为 => success(res, message, data)
  return success(res, '商品创建成功', product, 201);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body, req.user);
  return success(res, '商品更新成功', product);
});

export const adjustStock = asyncHandler(async (req, res) => {
  const { newStock, reason } = req.body;
  const product = await productService.adjustStock(req.params.id, newStock, reason, req.user);
  return success(res, '库存调整成功', product);
});

export const getProducts = asyncHandler(async (req, res) => {
  const products = await productService.getProducts(req.query);
  return success(res, '获取成功', products);
});

export const getStockStats = asyncHandler(async (req, res) => {
  const stats = await productService.getStockStats();
  return success(res, '获取成功', stats[0] || {});
});

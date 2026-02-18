import * as stockService from '../services/stock.service.js';
import * as productService from '../services/product.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

// ==================== 商品管理 ====================

// 创建商品（含SKU）
export const createProduct = asyncHandler(async (req, res) => {
  const data = await productService.createProduct(req.body, req.user);
  return success(res, '创建成功', data, 201);
});

// 更新商品
export const updateProduct = asyncHandler(async (req, res) => {
  const data = await productService.updateProduct(req.params.id, req.body, req.user);
  return success(res, '更新成功', data);
});

// 获取商品列表
export const getProducts = asyncHandler(async (req, res) => {
  const data = await productService.getProducts(req.query);
  return success(res, '获取成功', data);
});

// 获取单个商品
export const getProductById = asyncHandler(async (req, res) => {
  const data = await productService.getProductById(req.params.id);
  return success(res, '获取成功', data);
});

// 删除商品
export const deleteProduct = asyncHandler(async (req, res) => {
  const data = await productService.deleteProduct(req.params.id);
  return success(res, '删除成功', data);
});

// ==================== SKU管理 ====================

// 添加SKU
export const addSku = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const data = await productService.addSku(productId, req.body, req.user);
  return success(res, '添加成功', data, 201);
});

// 更新SKU
export const updateSku = asyncHandler(async (req, res) => {
  const { productId, skuId } = req.params;
  const data = await productService.updateSku(productId, skuId, req.body, req.user);
  return success(res, '更新成功', data);
});

// 删除SKU
export const deleteSku = asyncHandler(async (req, res) => {
  const { productId, skuId } = req.params;
  const data = await productService.deleteSku(productId, skuId, req.user);
  return success(res, '删除成功', data);
});

// ==================== 库存操作 ====================

// 调整SKU库存
export const adjustSkuStock = asyncHandler(async (req, res) => {
  const { productId, skuId } = req.params;
  const { quantity, reason } = req.body;
  
  const data = await stockService.adjustSkuStock(
    productId, 
    skuId, 
    quantity, 
    reason, 
    req.user
  );
  
  return success(res, '调整成功', data);
});

// 批量调整库存
export const batchAdjustStock = asyncHandler(async (req, res) => {
  const { adjustments } = req.body;
  
  const data = await stockService.batchAdjustStock(adjustments, req.user);
  
  return success(res, '批量调整成功', data);
});

// ==================== 订单绑定 ====================

// 绑定订单到库存
export const bindOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const bindData = req.body;
  
  const data = await stockService.bindOrderToStock(orderId, bindData, req.user);
  
  return success(res, '绑定成功', data, 201);
});

// 取消绑定
export const unbindOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  const data = await stockService.unbindOrder(orderId, req.user);
  
  return success(res, '取消绑定成功', data);
});

// 获取绑定记录
export const getBindRecords = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;
  
  const filter = {};
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  
  const OrderBind = (await import('../models/orderBind.model.js')).default;
  const data = await OrderBind.find(filter)
    .populate('orderId')
    .populate('bindBy', 'name')
    .sort({ createdAt: -1 });
  
  return success(res, '获取成功', data);
});

// 获取待绑定订单
export const getPendingBindOrders = asyncHandler(async (req, res) => {
  const data = await stockService.getPendingBindOrders();
  return success(res, '获取成功', data);
});

// ==================== 统计与预警 ====================

// 获取库存统计
export const getStockStats = asyncHandler(async (req, res) => {
  const { categoryId } = req.query;
  const data = await stockService.getStockStats(categoryId);
  return success(res, '获取成功', data);
});

// 获取库存预警
export const getStockWarnings = asyncHandler(async (req, res) => {
  const data = await stockService.getStockWarnings();
  return success(res, '获取成功', data);
});

// 获取资金预警
export const getFundWarnings = asyncHandler(async (req, res) => {
  const data = await stockService.getFundWarnings();
  return success(res, '获取成功', data);
});

// 获取绑定统计
export const getBindStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await stockService.getBindStats(startDate, endDate);
  return success(res, '获取成功', data);
});

// 获取库存变动日志
export const getStockLogs = asyncHandler(async (req, res) => {
  const { productId, skuId, module, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  const StockLog = (await import('../models/stockLog.model.js')).default;
  const filter = {};
  
  if (module) filter.module = module;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [logs, total] = await Promise.all([
    StockLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    StockLog.countDocuments(filter)
  ]);
  
  return success(res, '获取成功', {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

export default {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  deleteProduct,
  addSku,
  updateSku,
  deleteSku,
  adjustSkuStock,
  batchAdjustStock,
  bindOrder,
  unbindOrder,
  getBindRecords,
  getPendingBindOrders,
  getStockStats,
  getStockWarnings,
  getFundWarnings,
  getBindStats,
  getStockLogs
};

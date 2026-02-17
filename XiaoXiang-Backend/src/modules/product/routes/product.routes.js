import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/stock.controller.js';
import * as auditCtrl from '../controllers/audit.controller.js';
import * as reportCtrl from '../controllers/report.controller.js';

const router = express.Router();

// ==================== 商品路由 ====================

// 获取商品列表
router.get('/products', authenticate, ctrl.getProducts);

// 获取单个商品
router.get('/products/:id', authenticate, ctrl.getProductById);

// 创建商品
router.post('/products', authenticate, authorize('admin'), ctrl.createProduct);

// 更新商品
router.put('/products/:id', authenticate, authorize('admin'), ctrl.updateProduct);

// 删除商品
router.delete('/products/:id', authenticate, authorize('admin'), ctrl.deleteProduct);

// ==================== SKU路由 ====================

// 添加SKU
router.post('/products/:productId/skus', authenticate, authorize('admin'), ctrl.addSku);

// 更新SKU
router.put('/products/:productId/skus/:skuId', authenticate, authorize('admin'), ctrl.updateSku);

// 删除SKU
router.delete('/products/:productId/skus/:skuId', authenticate, authorize('admin'), ctrl.deleteSku);

// ==================== 库存操作路由 ====================

// 调整SKU库存
router.patch('/products/:productId/skus/:skuId/stock', authenticate, authorize('admin'), ctrl.adjustSkuStock);

// 批量调整库存
router.post('/stock/batch-adjust', authenticate, authorize('admin'), ctrl.batchAdjustStock);

// 获取库存变动日志
router.get('/stock/logs', authenticate, ctrl.getStockLogs);

// ==================== 订单绑定路由 ====================

// 获取待绑定订单
router.get('/bind/pending', authenticate, authorize('admin'), ctrl.getPendingBindOrders);

// 获取绑定记录
router.get('/bind/records', authenticate, authorize('admin'), ctrl.getBindRecords);

// 绑定订单
router.post('/bind/:orderId', authenticate, authorize('admin'), ctrl.bindOrder);

// 取消绑定
router.delete('/bind/:orderId', authenticate, authorize('admin'), ctrl.unbindOrder);

// ==================== 统计路由 ====================

// 获取库存统计
router.get('/stats', authenticate, ctrl.getStockStats);

// 获取库存预警
router.get('/warnings/stock', authenticate, ctrl.getStockWarnings);

// 获取资金预警
router.get('/warnings/fund', authenticate, ctrl.getFundWarnings);

// 获取绑定统计
router.get('/bind/stats', authenticate, ctrl.getBindStats);

// ==================== 夜审路由 ====================

// 获取今日审计
router.get('/audit/today', authenticate, authorize('admin'), auditCtrl.getTodayAudit);

// 获取审计历史
router.get('/audit/history', authenticate, authorize('admin'), auditCtrl.getAuditHistory);

// 执行夜审
router.post('/audit/execute', authenticate, authorize('admin'), auditCtrl.executeAudit);

// 获取审计详情
router.get('/audit/:id', authenticate, authorize('admin'), auditCtrl.getAuditById);

// 获取审计统计
router.get('/audit/stats/summary', authenticate, authorize('admin'), auditCtrl.getAuditStats);

// ==================== 报表路由 ====================

// 获取收益概览
router.get('/report/overview', authenticate, reportCtrl.getOverview);

// 获取结算预警
router.get('/report/warnings', authenticate, reportCtrl.getWarnings);

// 获取资金预测
router.get('/report/forecast', authenticate, reportCtrl.getForecast);

export default router;

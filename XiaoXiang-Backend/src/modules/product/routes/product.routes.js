import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/product.controller.js';
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

// 调整库存
router.patch('/products/:id/stock', authenticate, authorize('admin'), ctrl.adjustStock);

// 删除商品
router.delete('/products/:id', authenticate, authorize('admin'), ctrl.deleteProduct);

// ==================== 统计路由 ====================

// 获取库存统计
router.get('/stats', authenticate, ctrl.getStats);

// 获取收益概览
router.get('/report/overview', authenticate, reportCtrl.getOverview);

// 获取结算预警
router.get('/report/warnings', authenticate, reportCtrl.getWarnings);

// 获取资金预测
router.get('/report/forecast', authenticate, reportCtrl.getForecast);

export default router;

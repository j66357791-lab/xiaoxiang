import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/product.controller.js';
const router = express.Router();

// 商品列表
router.get('/products', authenticate, ctrl.getProducts);

// 创建商品
router.post('/products', authenticate, authorize('admin'), ctrl.createProduct);

// 更新商品（修复：匹配前端调用路径）
router.put('/products/:id', authenticate, authorize('admin'), ctrl.updateProduct);

// 更新商品价格（保留兼容）
router.put('/products/:id/price', authenticate, authorize('admin'), ctrl.updateProductPrice);

// 调整库存
router.patch('/products/:id/stock', authenticate, authorize('admin'), ctrl.adjustStock);

// 统计数据
router.get('/stats', authenticate, ctrl.getStats);

// 导出
router.get('/products/export', authenticate, authorize('admin'), ctrl.exportProducts);

export default router;

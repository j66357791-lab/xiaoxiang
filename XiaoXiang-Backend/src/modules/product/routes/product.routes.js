import express from 'express';
// ✅ 修正：使用 authenticate 替代 protect
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as productController from '../controllers/product.controller.js';

const router = express.Router();

// 公开接口 (加上认证中间件)
router.get('/products', authenticate, productController.getProducts);
router.get('/stats', authenticate, productController.getStockStats);

// 管理员接口
router.post('/products', authenticate, authorize('admin'), productController.createProduct);
router.put('/products/:id', authenticate, authorize('admin'), productController.updateProduct);
router.patch('/products/:id/stock', authenticate, authorize('admin'), productController.adjustStock);

export default router;

import express from 'express';
// 修正：使用 protect 和 authorize
import { protect, authorize } from '../../../common/middlewares/auth.js';
import * as productController from '../controllers/product.controller.js';

const router = express.Router();

// 公开接口 (如果需要登录才能看库存，请加上 protect)
router.get('/products', protect, productController.getProducts);
router.get('/stats', protect, productController.getStockStats);

// 管理员接口
router.post('/products', protect, authorize('admin'), productController.createProduct);
router.put('/products/:id', protect, authorize('admin'), productController.updateProduct);
router.patch('/products/:id/stock', protect, authorize('admin'), productController.adjustStock);

export default router;

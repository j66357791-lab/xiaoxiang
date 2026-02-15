import express from 'express';
import { auth, authorize } from '../../../common/middlewares/auth.js';
import * as productController from '../controllers/product.controller.js';

const router = express.Router();

// 修正：路径改为 /products 以匹配前端 /api/stock/products
router.get('/products', auth, productController.getProducts);
router.get('/stats', auth, productController.getStockStats);

router.post('/products', auth, authorize('admin'), productController.createProduct);
router.put('/products/:id', auth, authorize('admin'), productController.updateProduct);
router.patch('/products/:id/stock', auth, authorize('admin'), productController.adjustStock);

export default router;

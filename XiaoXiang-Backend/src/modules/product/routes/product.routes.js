import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/product.controller.js';
const router = express.Router();

router.get('/products', authenticate, ctrl.getProducts);
router.post('/products', authenticate, authorize('admin'), ctrl.createProduct);
router.put('/products/:id/price', authenticate, authorize('admin'), ctrl.updateProductPrice);
router.patch('/products/:id/stock', authenticate, authorize('admin'), ctrl.adjustStock);
router.get('/stats', authenticate, ctrl.getStats);
router.get('/products/export', authenticate, authorize('admin'), ctrl.exportProducts);
export default router;

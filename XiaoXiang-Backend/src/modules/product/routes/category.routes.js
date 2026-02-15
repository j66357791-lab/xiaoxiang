import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/category.controller.js';
const router = express.Router();

router.get('/', authenticate, ctrl.getCategories);
router.post('/', authenticate, authorize('admin'), ctrl.createCategory);
router.put('/:id', authenticate, authorize('admin'), ctrl.updateCategory);
router.delete('/:id', authenticate, authorize('admin'), ctrl.deleteCategory);
export default router;

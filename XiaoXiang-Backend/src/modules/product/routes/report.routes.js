import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/report.controller.js';
const router = express.Router();

router.post('/generate', authenticate, authorize('admin'), ctrl.generateReport);
router.get('/list', authenticate, ctrl.getReports);
router.get('/export/:id', authenticate, authorize('admin'), ctrl.exportReport);
export default router;

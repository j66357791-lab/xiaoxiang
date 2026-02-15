import express from 'express';
// ✅ 修正：使用 authenticate 替代 protect
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as reportController from '../controllers/report.controller.js';

const router = express.Router();

router.post('/generate', authenticate, authorize('admin'), reportController.generateReport);
router.get('/list', authenticate, reportController.getReports);

export default router;

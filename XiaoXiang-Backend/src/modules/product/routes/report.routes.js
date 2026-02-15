import express from 'express';
import { protect, authorize } from '../../../common/middlewares/auth.js';
import * as reportController from '../controllers/report.controller.js';

const router = express.Router();

router.post('/generate', protect, authorize('admin'), reportController.generateReport);
router.get('/list', protect, reportController.getReports);

export default router;

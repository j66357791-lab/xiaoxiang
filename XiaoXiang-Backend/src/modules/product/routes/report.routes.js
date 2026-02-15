import express from 'express';
import { auth, authorize } from '../../../common/middlewares/auth.js';
import * as reportController from '../controllers/report.controller.js';

const router = express.Router();

router.post('/generate', auth, authorize('admin'), reportController.generateReport);
router.get('/list', auth, reportController.getReports);

export default router;

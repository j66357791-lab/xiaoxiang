import express from 'express';
import { authenticate } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/notification.controller.js';
const router = express.Router();

router.post('/register', authenticate, ctrl.registerToken);
export default router;

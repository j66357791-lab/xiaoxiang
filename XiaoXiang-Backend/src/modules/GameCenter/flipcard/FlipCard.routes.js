import { Router } from 'express';
import { FlipCardController } from './FlipCard.controller.js';
import { authenticate } from '../../../common/middlewares/auth.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

const router = Router();
router.post('/start', authenticate, asyncHandler(FlipCardController.start));
router.post('/flip', authenticate, asyncHandler(FlipCardController.flip));
router.post('/settle', authenticate, asyncHandler(FlipCardController.settle));

export default router;

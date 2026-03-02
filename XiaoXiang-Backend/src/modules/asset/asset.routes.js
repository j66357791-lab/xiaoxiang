// src/modules/assets/asset.routes.js
import express from 'express';
import { 
  createFromOrder, 
  getAssets, 
  updateAsset, 
  revertAsset,
  deleteAsset
} from './asset.controller.js';

const router = express.Router();

router.post('/from-order', createFromOrder);
router.get('/', getAssets);
router.put('/:id', updateAsset);
router.post('/:id/revert', revertAsset);
router.delete('/:id', deleteAsset);

export default router;

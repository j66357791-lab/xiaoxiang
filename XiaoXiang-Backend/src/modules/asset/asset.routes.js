import express from 'express';
import { createFromOrder, getAssets, updateAsset } from './asset.controller.js';

const router = express.Router();

router.post('/from-order', createFromOrder);
router.get('/', getAssets);
router.put('/:id', updateAsset); // 🔥 新增：更新接口

export default router;

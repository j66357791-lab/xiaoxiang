// src/modules/asset/asset.routes.js
import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { AssetController } from './asset.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// 所有资产接口仅管理员可访问
router.use(authenticate);
router.use(authorize('admin', 'superAdmin'));

// 🔥 同步路由 (必须放在 /:id 前面)
router.post('/sync', asyncHandler(AssetController.syncAssets));

// 资产列表
router.get('/', asyncHandler(AssetController.getAssets));

// 资产详情
router.get('/:id', asyncHandler(AssetController.getAssetById));

// 资产处置
router.put('/:id/dispose', asyncHandler(AssetController.disposeAsset));

export default router;

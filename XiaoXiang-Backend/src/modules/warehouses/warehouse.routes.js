// src/modules/warehouses/warehouse.routes.js

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { WarehouseController } from './warehouse.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ==================== 公开接口 ====================
router.get('/areas', asyncHandler(WarehouseController.getServiceAreas));
router.get('/city/:city', asyncHandler(WarehouseController.getWarehousesByCity));
router.get('/default', asyncHandler(WarehouseController.getDefaultWarehouse));
router.get('/', asyncHandler(WarehouseController.getAllWarehouses));
router.get('/:id', asyncHandler(WarehouseController.getWarehouseById));

// ==================== 管理员接口 ====================
router.post('/',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(WarehouseController.createWarehouse)
);

router.put('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(WarehouseController.updateWarehouse)
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'superAdmin'),
  asyncHandler(WarehouseController.deleteWarehouse)
);

export default router;

// src/modules/warehouses/warehouse.routes.js
// 仓库路由

import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth.js';
import { WarehouseController } from './warehouse.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

const router = Router();

// ==================== 用户端接口（放在前面，避免被 :id 匹配）====================

// 获取可用仓库列表（用户端）
router.get('/available', 
  authenticate, 
  asyncHandler(WarehouseController.getAvailableWarehouses)
);

// 获取服务区域
router.get('/service-areas', 
  authenticate, 
  asyncHandler(WarehouseController.getServiceAreas)
);

// 按城市检查上门回收
router.post('/check-pickup-city', 
  authenticate, 
  asyncHandler(WarehouseController.checkPickupByCity)
);

// 基于位置检查上门回收
router.post('/check-pickup', 
  authenticate, 
  asyncHandler(WarehouseController.checkPickupAvailability)
);

// ==================== 管理员接口 ====================

// 获取所有仓库（管理员）
router.get('/admin/all', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(WarehouseController.getAllWarehouses)
);

// 创建仓库（管理员）
router.post('/admin', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(WarehouseController.createWarehouse)
);

// 获取仓库详情（管理员）
router.get('/admin/:id', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(WarehouseController.getWarehouseById)
);

// 更新仓库（管理员）
router.put('/admin/:id', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(WarehouseController.updateWarehouse)
);

// 删除仓库（管理员）
router.delete('/admin/:id', 
  authenticate, 
  authorize('admin', 'superAdmin'), 
  asyncHandler(WarehouseController.deleteWarehouse)
);

export default router;

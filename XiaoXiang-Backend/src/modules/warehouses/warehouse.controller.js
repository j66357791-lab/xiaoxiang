// src/modules/warehouses/warehouse.controller.js

import { success } from '../../common/utils/response.js';
import { WarehouseService } from './warehouse.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class WarehouseController {
  
  static getAllWarehouses = asyncHandler(async (req, res) => {
    const warehouses = await WarehouseService.getAllWarehouses(req.query);
    return success(res, warehouses);
  });
  
  static getWarehouseById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const warehouse = await WarehouseService.getWarehouseById(id);
    return success(res, warehouse);
  });
  
  static createWarehouse = asyncHandler(async (req, res) => {
    console.log('[WarehouseController] 📝 创建仓库');
    const warehouse = await WarehouseService.createWarehouse(req.body);
    return success(res, warehouse, '创建成功', 201);
  });
  
  static updateWarehouse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[WarehouseController] 📝 更新仓库:', id);
    const warehouse = await WarehouseService.updateWarehouse(id, req.body);
    return success(res, warehouse, '更新成功');
  });
  
  static deleteWarehouse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log('[WarehouseController] 🗑️ 删除仓库:', id);
    await WarehouseService.deleteWarehouse(id);
    return success(res, null, '删除成功');
  });
  
  static getDefaultWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await WarehouseService.getDefaultWarehouse();
    return success(res, warehouse);
  });
  
  static getWarehousesByCity = asyncHandler(async (req, res) => {
    const { city } = req.params;
    const warehouses = await WarehouseService.getWarehousesByCity(city);
    return success(res, warehouses);
  });
  
  static getServiceAreas = asyncHandler(async (req, res) => {
    const areas = await WarehouseService.getServiceAreas();
    return success(res, areas);
  });
}

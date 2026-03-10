// src/modules/warehouses/warehouse.controller.js
// 仓库控制器

import { success } from '../../common/utils/response.js';
import { WarehouseService } from './warehouse.service.js';

export class WarehouseController {
  
  /**
   * 获取所有仓库（管理员）
   */
  static getAllWarehouses = async (req, res) => {
    try {
      const warehouses = await WarehouseService.getAllWarehouses(req.query);
      return success(res, warehouses);
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 获取可用仓库列表（用户端）
   */
  static getAvailableWarehouses = async (req, res) => {
    try {
      console.log('[WarehouseController] 获取可用仓库列表');
      const warehouses = await WarehouseService.getAvailableWarehouses();
      return success(res, warehouses);
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 获取仓库详情
   */
  static getWarehouseById = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('[WarehouseController] 获取仓库详情:', id);
      const warehouse = await WarehouseService.getWarehouseById(id);
      return success(res, warehouse);
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 创建仓库
   */
  static createWarehouse = async (req, res) => {
    try {
      const warehouse = await WarehouseService.createWarehouse(req.body);
      return success(res, warehouse, '创建成功', 201);
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 更新仓库
   */
  static updateWarehouse = async (req, res) => {
    try {
      const { id } = req.params;
      const warehouse = await WarehouseService.updateWarehouse(id, req.body);
      return success(res, warehouse, '更新成功');
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 删除仓库
   */
  static deleteWarehouse = async (req, res) => {
    try {
      const { id } = req.params;
      const warehouse = await WarehouseService.deleteWarehouse(id);
      return success(res, warehouse, '删除成功');
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 获取服务区域
   */
  static getServiceAreas = async (req, res) => {
    try {
      const areas = await WarehouseService.getServiceAreas();
      return success(res, areas);
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 按城市检查上门回收
   */
  static checkPickupByCity = async (req, res) => {
    try {
      const { city } = req.body;
      const result = await WarehouseService.checkPickupByCity(city);
      return success(res, result);
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 基于位置检查上门回收
   */
  static checkPickupAvailability = async (req, res) => {
    try {
      const { longitude, latitude } = req.body;
      const warehouses = await WarehouseService.checkPickupAvailability(longitude, latitude);
      return success(res, warehouses);
    } catch (error) {
      throw error;
    }
  };
}

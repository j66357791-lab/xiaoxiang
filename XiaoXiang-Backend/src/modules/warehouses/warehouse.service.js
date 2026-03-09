// src/modules/warehouses/warehouse.service.js
// 仓库服务（优化版）

import mongoose from 'mongoose';
import Warehouse from './warehouse.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/error.js';

export class WarehouseService {
  
  /**
   * 获取所有仓库
   */
  static async getAllWarehouses(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) { filter.isActive = query.isActive === 'true'; }
    if (query.city) filter['address.city'] = query.city;
    if (query.province) filter['address.province'] = query.province;
    
    return await Warehouse.find(filter)
      .sort({ sort: 1, createdAt: 1 })
      .lean();
  }
  
  /**
   * 获取仓库详情
   */
  static async getWarehouseById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) { throw new NotFoundError('仓库ID无效'); }
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) throw new NotFoundError('仓库不存在');
    return warehouse;
  }
  
  /**
   * 创建仓库
   */
  static async createWarehouse(data) {
    console.log('[WarehouseService] 📝 创建仓库...');
    if (data.code) {
      const existing = await Warehouse.findOne({ code: data.code });
      if (existing) throw new ConflictError('仓库编码已存在');
    }
    if (data.isDefault) { await Warehouse.updateMany({ isDefault: true }, { isDefault: false }); }
    
    const warehouse = await Warehouse.create({
      name: data.name,
      code: data.code,
      address: {
        province: data.province,
        city: data.city,
        district: data.district,
        detail: data.detail,
        longitude: data.longitude,
        latitude: data.latitude,
      },
      contact: {
        person: data.contactPerson,
        phone: data.contactPhone,
        email: data.contactEmail,
        wechat: data.contactWechat,
      },
      businessHours: data.businessHours || {},
      service: {
        serviceAreas: data.serviceAreas || [],
        supportPickup: data.supportPickup ?? false,
        pickupRadius: data.pickupRadius || 10,
        supportSelfDelivery: data.supportSelfDelivery ?? true,
        estimatedProcessDays: data.estimatedProcessDays || 3,
        freeShipping: data.freeShipping ?? true,
        expressPartners: data.expressPartners || [],
      },
      capacity: { maxDailyOrders: data.maxDailyOrders || 100, currentLoad: 0 },
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
      sort: data.sort || 0,
      notes: data.notes,
    });
    
    console.log('[WarehouseService] ✅ 创建成功, ID:', warehouse._id);
    return warehouse;
  }
  
  /**
   * 更新仓库
   */
  static async updateWarehouse(id, data) {
    console.log('[WarehouseService] 📝 更新仓库:', id);
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) throw new NotFoundError('仓库不存在');
    
    if (data.code && data.code !== warehouse.code) {
      const existing = await Warehouse.findOne({ code: data.code });
      if (existing) throw new ConflictError('仓库编码已存在');
    }
    if (data.isDefault && !warehouse.isDefault) {
      await Warehouse.updateMany({ isDefault: true }, { isDefault: false });
    }
    
    // 更新字段
    if (data.name) warehouse.name = data.name;
    if (data.code) warehouse.code = data.code;
    if (data.province !== undefined) warehouse.address.province = data.province;
    if (data.city !== undefined) warehouse.address.city = data.city;
    if (data.district !== undefined) warehouse.address.district = data.district;
    if (data.detail !== undefined) warehouse.address.detail = data.detail;
    if (data.longitude !== undefined) warehouse.address.longitude = data.longitude;
    if (data.latitude !== undefined) warehouse.address.latitude = data.latitude;
    if (data.contactPerson !== undefined) warehouse.contact.person = data.contactPerson;
    if (data.contactPhone !== undefined) warehouse.contact.phone = data.contactPhone;
    if (data.contactEmail !== undefined) warehouse.contact.email = data.contactEmail;
    if (data.contactWechat !== undefined) warehouse.contact.wechat = data.contactWechat;
    if (data.businessHours) warehouse.businessHours = { ...warehouse.businessHours, ...data.businessHours };
    if (data.serviceAreas !== undefined) warehouse.service.serviceAreas = data.serviceAreas;
    if (data.supportPickup !== undefined) warehouse.service.supportPickup = data.supportPickup;
    if (data.pickupRadius !== undefined) warehouse.service.pickupRadius = data.pickupRadius;
    if (data.supportSelfDelivery !== undefined) warehouse.service.supportSelfDelivery = data.supportSelfDelivery;
    if (data.estimatedProcessDays !== undefined) warehouse.service.estimatedProcessDays = data.estimatedProcessDays;
    if (data.freeShipping !== undefined) warehouse.service.freeShipping = data.freeShipping;
    if (data.expressPartners !== undefined) warehouse.service.expressPartners = data.expressPartners;
    if (data.maxDailyOrders !== undefined) warehouse.capacity.maxDailyOrders = data.maxDailyOrders;
    if (data.isActive !== undefined) warehouse.isActive = data.isActive;
    if (data.isDefault !== undefined) warehouse.isDefault = data.isDefault;
    if (data.sort !== undefined) warehouse.sort = data.sort;
    if (data.notes !== undefined) warehouse.notes = data.notes;
    
    await warehouse.save();
    console.log('[WarehouseService] ✅ 更新成功');
    return warehouse;
  }
  
  /**
   * 删除仓库
   */
  static async deleteWarehouse(id) {
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) throw new NotFoundError('仓库不存在');
    if (warehouse.isDefault) { throw new BadRequestError('默认仓库不能删除'); }
    await Warehouse.findByIdAndDelete(id);
    console.log('[WarehouseService] 🗑️ 删除成功:', warehouse.name);
    return warehouse;
  }
  
  /**
   * 获取默认仓库
   */
  static async getDefaultWarehouse() {
    return await Warehouse.getDefault();
  }
  
  /**
   * 根据城市获取仓库
   */
  static async getWarehousesByCity(city) {
    return await Warehouse.getByCity(city);
  }
  
  /**
   * 获取服务区域
   */
  static async getServiceAreas() {
    const warehouses = await Warehouse.find({ isActive: true }).lean();
    const areas = {};
    warehouses.forEach(w => {
      const province = w.address.province;
      const city = w.address.city;
      if (!areas[province]) areas[province] = new Set();
      areas[province].add(city);
    });
    const result = {};
    for (const province in areas) { result[province] = Array.from(areas[province]); }
    return result;
  }
  
  /**
   * 🆕 检查上门回收服务
   * 根据用户经纬度查找支持上门的仓库
   */
  static async checkPickupAvailability(longitude, latitude) {
    if (!longitude || !latitude) throw new BadRequestError('缺少位置信息');
    
    console.log('[WarehouseService] 📍 检查上门回收服务:', { longitude, latitude });
    
    const warehouses = await Warehouse.find({
      isActive: true,
      'service.supportPickup': true,
      'address.latitude': { $exists: true },
      'address.longitude': { $exists: true }
    }).lean();
    
    const results = warehouses.map(wh => {
      const distance = this.calculateDistance(
        latitude, longitude,
        wh.address.latitude, wh.address.longitude
      );
      
      return {
        _id: wh._id,
        name: wh.name,
        address: wh.address,
        contact: wh.contact,
        businessHours: wh.businessHours,
        service: wh.service,
        distance: parseFloat(distance.toFixed(2)),
        inService: distance <= wh.service.pickupRadius,
      };
    });
    
    // 按距离排序，只返回在服务范围内的仓库
    const availableWarehouses = results
      .filter(r => r.inService)
      .sort((a, b) => a.distance - b.distance);
    
    console.log('[WarehouseService] ✅ 找到', availableWarehouses.length, '个可用仓库');
    
    return availableWarehouses;
  }
  
  /**
   * 🆕 计算两点之间的距离（公里）
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径 km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  /**
   * 🆕 获取用户可用的仓库列表（用于快递寄送选择）
   */
  static async getAvailableWarehouses() {
    return await Warehouse.find({ isActive: true })
      .select('name address contact businessHours service isDefault sort')
      .sort({ isDefault: -1, sort: 1 })
      .lean();
  }
  
  /**
   * 🆕 检查地址是否在服务区域内
   */
  static async checkServiceArea(province, city, district) {
    const warehouses = await Warehouse.find({
      isActive: true,
      'address.province': province,
      'address.city': city,
    }).lean();
    
    return warehouses.map(wh => ({
      _id: wh._id,
      name: wh.name,
      address: wh.address,
      contact: wh.contact,
      supportsPickup: wh.service.supportPickup,
      supportsSelfDelivery: wh.service.supportSelfDelivery,
    }));
  }
  
  /**
   * 🆕 更新仓库负载
   */
  static async updateCapacity(id, delta) {
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) throw new NotFoundError('仓库不存在');
    
    warehouse.capacity.currentLoad = Math.max(0, warehouse.capacity.currentLoad + delta);
    await warehouse.save();
    
    return warehouse;
  }
}

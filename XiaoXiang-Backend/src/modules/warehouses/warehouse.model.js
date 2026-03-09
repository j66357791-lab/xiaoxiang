// src/modules/warehouses/warehouse.model.js
// 质检仓库模型

import mongoose from 'mongoose';

const WarehouseSchema = new mongoose.Schema({
  // ==================== 基本信息 ====================
  name: { type: String, required: true },
  code: { type: String, unique: String },
  
  // ==================== 地址信息 ====================
  address: {
    province: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String },
    detail: { type: String, required: true },
    longitude: { type: Number },
    latitude: { type: Number },
  },
  
  // ==================== 联系信息 ====================
  contact: {
    person: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    wechat: { type: String },
  },
  
  // ==================== 营业时间 ====================
  businessHours: {
    weekdays: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '18:00' },
    },
    weekend: {
      open: { type: String, default: '10:00' },
      close: { type: String, default: '17:00' },
    },
  },
  
  // ==================== 服务配置 ====================
  service: {
    serviceAreas: [String],
    supportPickup: { type: Boolean, default: false },
    pickupRadius: { type: Number, default: 10 },
    supportSelfDelivery: { type: Boolean, default: true },
    estimatedProcessDays: { type: Number, default: 3 },
    freeShipping: { type: Boolean, default: true },
    expressPartners: [String],
  },
  
  // ==================== 仓库容量 ====================
  capacity: {
    maxDailyOrders: { type: Number, default: 100 },
    currentLoad: { type: Number, default: 0 },
  },
  
  // ==================== 状态 ====================
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  
  // ==================== 排序 ====================
  sort: { type: Number, default: 0 },
  
  // ==================== 备注 ====================
  notes: { type: String },
  
}, { 
  timestamps: true 
});

// ==================== 索引 ====================
WarehouseSchema.index({ 'address.province': 1, 'address.city': 1 });
WarehouseSchema.index({ isActive: 1 });
WarehouseSchema.index({ sort: 1 });

// ==================== 静态方法 ====================
WarehouseSchema.statics.getDefault = async function() {
  return await this.findOne({ isDefault: true, isActive: true });
};

WarehouseSchema.statics.getByCity = async function(city) {
  return await this.find({
    'address.city': city,
    isActive: true,
  }).sort({ sort: 1 });
};

export default mongoose.model('Warehouse', WarehouseSchema);

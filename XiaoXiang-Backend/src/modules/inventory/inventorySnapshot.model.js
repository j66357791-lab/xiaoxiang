// src/modules/inventory/inventorySnapshot.model.js
import mongoose from 'mongoose';

/**
 * 库存快照模型
 * 
 * 设计理念：
 * - 不关联任何其他表
 * - 直接存储前端处理好的完整数据（SKU、分类、绑定订单）
 * - 支持版本管理：最新版本 + 最多3个历史版本
 */
const InventorySnapshotSchema = new mongoose.Schema({
  // 快照数据
  data: {
    skuList: {
      type: Array,
      default: []
    },
    categories: {
      type: Array,
      default: []
    },
    bindOrders: {
      type: Array,
      default: []
    },
    stats: {
      totalSku: { type: Number, default: 0 },
      totalStock: { type: Number, default: 0 },
      totalBindOrders: { type: Number, default: 0 }
    }
  },
  
  // 存档备注
  remark: {
    type: String,
    default: ''
  },
  
  // 版本号（自动递增）
  version: {
    type: Number,
    default: 1
  },
  
  // 是否为当前最新版本
  isLatest: {
    type: Boolean,
    default: true
  }

}, { 
  timestamps: true // 自动生成 createdAt, updatedAt
});

// 索引：按创建时间倒序
InventorySnapshotSchema.index({ createdAt: -1 });

const InventorySnapshot = mongoose.model('InventorySnapshot', InventorySnapshotSchema);
export default InventorySnapshot;

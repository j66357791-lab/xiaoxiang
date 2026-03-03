// src/modules/asset/assetSnapshot.model.js
import mongoose from 'mongoose';

/**
 * 资产快照模型
 * 
 * 设计理念：
 * - 不关联任何其他表（Order、User 等）
 * - 直接存储前端处理好的完整数据
 * - 支持版本管理：最新版本 + 最多3个历史版本
 */
const AssetSnapshotSchema = new mongoose.Schema({
  // 快照数据：前端完整数据，直接存 JSON
  snapshot: {
    type: Object,
    required: true,
    default: {}
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
AssetSnapshotSchema.index({ createdAt: -1 });

const AssetSnapshot = mongoose.model('AssetSnapshot', AssetSnapshotSchema);
export default AssetSnapshot;

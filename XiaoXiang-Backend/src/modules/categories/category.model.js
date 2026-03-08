// src/modules/categories/category.model.js
import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  // ========== 基本信息 ==========
  name: { type: String, required: true },
  color: { type: String, default: '#4364F7' },
  icon: { type: String },              // 🆕 分类图标URL
  image: { type: String },             // 🆕 分类图片URL
  description: { type: String },       // 🆕 分类描述
  
  // ========== 层级关系 ==========
  parentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    default: null 
  },
  level: { 
    type: Number, 
    enum: [1, 2, 3], 
    required: true 
  },
  
  // ========== 🆕 自定义属性配置 ==========
  // 用于存储该分类下的商品需要填写的属性
  // 例如：手机分类需要填写"容量"、"颜色"，衣服分类需要填写"尺码"
  attributes: [{
    name: { type: String, required: true },      // 属性名：容量、颜色、尺码
    type: { 
      type: String, 
      enum: ['select', 'input', 'multiSelect'],  // 属性类型：下拉选择、文本输入、多选
      default: 'select'
    },
    required: { type: Boolean, default: false }, // 是否必填
    options: [String],                           // 可选项：["64G", "128G", "256G"]
    unit: { type: String },                      // 单位：GB、年、次
    sort: { type: Number, default: 0 },          // 排序
  }],
  
  // ========== 🆕 价格配置 ==========
  priceConfig: {
    basePrice: { type: Number, default: 0 },      // 基础参考价
    priceUnit: { type: String, default: '元' },   // 价格单位
    enableRange: { type: Boolean, default: true }, // 是否启用价格范围
  },
  
  // ========== 🆕 回收配置 ==========
  recycleConfig: {
    enableRecycle: { type: Boolean, default: true },  // 是否开启回收
    enableTrade: { type: Boolean, default: false },   // 是否支持以旧换新
    estimatedDays: { type: Number, default: 3 },      // 预计处理天数
  },
  
  // ========== 状态 ==========
  isActive: { type: Boolean, default: true },
  sort: { type: Number, default: 0 },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段：子分类
CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId',
  justOne: false,
});

// 索引
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ level: 1 });
CategorySchema.index({ sort: 1 });

export default mongoose.model('Category', CategorySchema);

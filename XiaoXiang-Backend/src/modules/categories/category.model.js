// src/modules/categories/category.model.js
import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#4364F7' },
  icon: { type: String },           // 🆕 图标URL
  parentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    default: null 
  },
  level: { type: Number, enum: [1, 2, 3], default: 1 },
  sort: { type: Number, default: 0 },        // 🆕 排序
  isActive: { type: Boolean, default: true }, // 🆕 是否启用
}, { 
  timestamps: true 
});

export default mongoose.model('Category', CategorySchema);

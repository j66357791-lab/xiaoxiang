import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#4364F7'
  },
  // 👇 新增：父分类ID，用于构建树形结构
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  // 👇 新增：层级深度 (1=一级, 2=二级, 3=三级)，方便查询
  level: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

export default mongoose.model('Category', CategorySchema);

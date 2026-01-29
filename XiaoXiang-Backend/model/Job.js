import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  amount: { type: Number, required: true }, // 单价
  totalSlots: { type: Number, required: true }, // 总人数
  appliedCount: { type: Number, default: 0 }, // 已接单人数
  isFrozen: { type: Boolean, default: false }, // 是否冻结(上锁)
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 发布者
}, {
  timestamps: true
});

export default mongoose.model('Job', JobSchema);

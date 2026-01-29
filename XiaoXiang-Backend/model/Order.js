import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  status: { 
    type: String, 
    enum: ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed'], 
    default: 'Applied' 
  },
  // 辅助字段，方便查询时快照显示（可选，防止任务删除后找不到信息）
  jobSnapshot: {
    title: String,
    amount: Number,
    categoryName: String
  }
}, {
  timestamps: true
});

export default mongoose.model('Order', OrderSchema);

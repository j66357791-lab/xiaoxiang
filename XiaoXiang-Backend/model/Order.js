import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  status: { 
    type: String, 
    enum: ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled'], 
    default: 'Applied' 
  },
  // 辅助字段，方便查询时快照显示（可选，防止任务删除后找不到信息）
  jobSnapshot: {
    title: String,
    amount: Number,
    categoryName: String
  },
  submittedAt: { type: Date }, // 提交时间
  reviewedAt: { type: Date }, // 审批时间
  completedAt: { type: Date }, // 完成时间
  cancelledAt: { type: Date } // 取消时间
}, {
  timestamps: true
});

// 添加状态变更的中间件
OrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    switch(this.status) {
      case 'Submitted':
        this.submittedAt = now;
        break;
      case 'Reviewing':
        this.reviewedAt = now;
        break;
      case 'Completed':
        this.completedAt = now;
        break;
      case 'Cancelled':
        this.cancelledAt = now;
        break;
    }
  }
  next();
});

export default mongoose.model('Order', OrderSchema);

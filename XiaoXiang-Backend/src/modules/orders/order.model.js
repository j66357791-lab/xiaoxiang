import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  status: {
    type: String,
    enum: ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled', 'Rejected'],
    default: 'Applied'
  },
  jobSnapshot: {
    title: String,
    subtitle: String,
    amount: Number,
    deadline: Date,
    categoryName: String,
    categories: {
      l1: { id: String, name: String, color: String },
      l2: { id: String, name: String, color: String },
      l3: { id: String, name: String, color: String }
    }
  },
  description: { type: String },
  evidence: [{ type: String }],
  
  // 🆕 赠送积分相关
  rewardPoints: { type: Number, default: 0 },           // 赠送积分数量（从任务快照）
  rewardPointsIssued: { type: Boolean, default: false }, // 是否已发放
  
  // 状态时间字段
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  pendingPaymentAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  rejectedAt: { type: Date },
  
  // 原因字段
  cancelReason: { type: String },
  rejectReason: { type: String },
  
  // 审批信息
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentProof: { type: String },
  paymentNote: { type: String },
}, {
  timestamps: true
});

// 优化 pre-save 钩子
OrderSchema.pre('save', function() {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch(this.status) {
      case 'Submitted':
        this.submittedAt = now;
        break;
      case 'Reviewing':
        this.reviewedAt = now;
        break;
      case 'PendingPayment':
        this.pendingPaymentAt = now;
        break;
      case 'Completed':
        this.completedAt = now;
        break;
      case 'Cancelled':
        this.cancelledAt = now;
        break;
      case 'Rejected':
        this.rejectedAt = now;
        break;
    }
  }
});

export default mongoose.model('Order', OrderSchema);

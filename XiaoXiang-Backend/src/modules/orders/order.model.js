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
  
  // 状态时间字段
  submittedAt: { type: Date },        // 用户提交时间
  reviewedAt: { type: Date },         // 开始审核时间
  pendingPaymentAt: { type: Date },   // 进入待打款时间
  completedAt: { type: Date },        // 完成时间
  cancelledAt: { type: Date },        // 取消时间
  rejectedAt: { type: Date },         // 驳回时间
  
  // 原因字段
  cancelReason: { type: String },     // 取消原因
  rejectReason: { type: String },     // 驳回原因
  
  // 审批信息
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 审核人
  paymentProof: { type: String },     // 打款凭证（如果有）
  paymentNote: { type: String },      // 打款备注
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
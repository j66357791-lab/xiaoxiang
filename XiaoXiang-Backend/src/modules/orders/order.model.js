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
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date }
}, {
  timestamps: true
});

// ✅ 修复：移除 next 参数
OrderSchema.pre('save', function() {
  console.log('[OrderModel] 🔧 执行 pre-save 钩子，状态:', this.status);
  
  if (this.isModified('status')) {
    const now = new Date();
    console.log('[OrderModel] 📅 状态变更，记录时间:', now);
    
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
      case 'Rejected':
        this.cancelledAt = now;
        break;
    }
  }
  
  console.log('[OrderModel] ✅ pre-save 钩子执行完成');
  // ❌ 不再需要 next() 调用
});

export default mongoose.model('Order', OrderSchema);
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

// ✅ 修复：正确接收 next 参数并在末尾调用
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
      case 'Rejected':
        this.cancelledAt = now;
        break;
    }
  }
  
  // ✅ 关键：调用 next() 继续保存流程
  next();
});

export default mongoose.model('Order', OrderSchema);

import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  status: { 
    type: String, 
    // 👈 修改点：增加 'Rejected'
    enum: ['Applied', 'Submitted', 'Reviewing', 'PendingPayment', 'Completed', 'Cancelled', 'Rejected'], 
    default: 'Applied' 
  },
  jobSnapshot: {
    title: String,
    amount: Number,
    categoryName: String
  },
  description: { type: String },
  // 数组类型，支持多图
  evidence: [{ type: String }],
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date }
}, {
  timestamps: true
});

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
      case 'Completed':
        this.completedAt = now;
        break;
      case 'Cancelled':
        this.cancelledAt = now;
        break;
      case 'Rejected':
        this.cancelledAt = now; // 驳回也可以记录为取消时间，或者新增 rejectedAt
        break;
    }
  }
});

export default mongoose.model('Order', OrderSchema);

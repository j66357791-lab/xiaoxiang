import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  amount: { type: Number, required: true },
  totalSlots: { type: Number, required: true },
  appliedCount: { type: Number, default: 0 },
  isFrozen: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deadline: { type: Date, required: true },
  deadlineHours: { type: Number },
  autoFreeze: { type: Boolean, default: true },
  contentImages: [{ type: String }],
  steps: [{ text: String, image: String }],
  amountLevels: [{ level: String, amount: Number }],
  type: { type: String, enum: ['single', 'multi'], default: 'single' },
  depositRequirement: { type: Number, default: 0 }, // 保证金要求
  kycRequired: { type: Boolean, default: false }    // 是否需要实名认证
}, {
  timestamps: true
});

// 自动冻结任务
JobSchema.pre('save', function() {
  const now = new Date();
  if (this.isModified('deadline') && this.autoFreeze) {
    if (this.deadline < now) {
      this.isFrozen = true;
    }
  }
});

// 静态方法：检查截止日期并自动冻结
JobSchema.statics.checkDeadlines = async function() {
  const now = new Date();
  const jobsToFreeze = await this.find({
    deadline: { $lt: now },
    isFrozen: false,
    autoFreeze: true
  });
  
  for (const job of jobsToFreeze) {
    job.isFrozen = true;
    await job.save();
    console.log(`[Job] 自动冻结任务: ${job._id}, 标题: ${job.title}`);
  }
  
  return jobsToFreeze.length;
};

export default mongoose.model('Job', JobSchema);

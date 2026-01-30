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
  deadline: { type: Date, required: true }, // 截止日期（具体时间）
  deadlineHours: { type: Number }, // 截止小时数（用于显示“xx小时内完成”）
  autoFreeze: { type: Boolean, default: true }, // 是否自动冻结
  contentImages: [{ type: String }], // 任务内容图片
  steps: [{ text: String, image: String }], // 做单步骤
  amountLevels: [{ level: String, amount: Number }], // 阶梯金额
  type: { type: String, enum: ['single', 'multi'], default: 'single' }, // 任务类型
}, {
  timestamps: true
});

// 添加自动冻结的中间件
JobSchema.pre('save', function(next) {
  const now = new Date();
  if (this.isModified('deadline') && this.autoFreeze) {
    // 检查截止日期是否已过
    if (this.deadline < now) {
      this.isFrozen = true;
    }
  }
  next();
});

// 添加定时任务检查截止日期（实际应用中需要使用 cron 或类似工具）
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

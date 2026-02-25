import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  
  categoryL1: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryL2: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryL3: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  
  content: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  totalSlots: { type: Number, required: true },
  appliedCount: { type: Number, default: 0 },
  
  // 🆕 赠送积分（休闲中心积分）
  rewardPoints: { type: Number, default: 0, min: 0 },
  
  isFrozen: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  
  scheduledAt: { type: Date },     
  isPublished: { type: Boolean, default: true }, 
  
  isLimitedTime: { type: Boolean, default: false }, 
  endAt: { type: Date }, 
  
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deadline: { type: Date, required: true },
  deadlineHours: { type: Number },
  autoFreeze: { type: Boolean, default: true },
  
  contentImages: [{ type: String }],
  steps: [{ text: String, image: String }],
  amountLevels: [{ level: String, amount: Number }],
  
  type: { type: String, enum: ['single', 'multi'], default: 'single' },
  
  depositRequirement: { type: Number, default: 0 }, 
  kycRequired: { type: Boolean, default: false },
  isRepeatable: { type: Boolean, default: false }
}, {
  timestamps: true
});

// pre-save 钩子
JobSchema.pre('save', function() {
  console.log('[JobModel] 🔧 执行 pre-save 钩子');
  const now = new Date();

  if (this.isModified('endAt') && this.endAt) {
    console.log(`[JobModel] ⏰ 设置限时任务，结束时间: ${this.endAt}`);
    this.isLimitedTime = true;
  }
  
  if (this.isModified('deadline') && this.autoFreeze) {
    if (this.deadline < now) {
      console.log('[JobModel] ❄️ 任务已过期，自动冻结');
      this.isFrozen = true;
    }
  }

  if (this.isModified('scheduledAt') && this.scheduledAt) {
    if (this.scheduledAt > now) {
      console.log(`[JobModel] ⏳ 任务定时发布，发布时间: ${this.scheduledAt}`);
      this.isPublished = false;
    } else {
      console.log('[JobModel] ✅ 定时时间已过，立即发布');
      this.isPublished = true;
    }
  }

  console.log('[JobModel] ✅ pre-save 钩子执行完成');
});

// 静态方法：检查任务截止时间
JobSchema.statics.checkDeadlines = async function() {
  const now = new Date();
  console.log(`[JobModel] ⏰ 开始检查任务截止时间: ${now}`);
  
  // 1. 检查定时发布的任务
  const jobsToPublish = await this.find({ 
    scheduledAt: { $lte: now }, 
    isPublished: false 
  });
  console.log(`[JobModel] 📅 找到 ${jobsToPublish.length} 个待发布任务`);
  
  for (const job of jobsToPublish) {
    job.isPublished = true;
    await job.save();
    console.log(`[JobModel] ✅ 自动发布任务: ${job._id} - ${job.title}`);
  }

  // 2. 检查限时抢购结束的任务
  const jobsToEnd = await this.find({
    endAt: { $lt: now },
    isLimitedTime: true,
    isFrozen: false
  });
  console.log(`[JobModel] ⏰ 找到 ${jobsToEnd.length} 个限时任务已结束`);
  
  for (const job of jobsToEnd) {
    job.isFrozen = true;
    await job.save();
    console.log(`[JobModel] ❄️ 限时抢购结束，自动冻结: ${job._id} - ${job.title}`);
  }

  // 3. 检查普通过期任务
  const jobsToFreeze = await this.find({
    deadline: { $lt: now },
    isFrozen: false,
    autoFreeze: true
  });
  console.log(`[JobModel] 📅 找到 ${jobsToFreeze.length} 个已过期任务`);
  
  for (const job of jobsToFreeze) {
    job.isFrozen = true;
    await job.save();
    console.log(`[JobModel] ❄️ 自动冻结过期任务: ${job._id} - ${job.title}`);
  }
  
  console.log('[JobModel] ✅ 任务截止时间检查完成');
};

export default mongoose.model('Job', JobSchema);

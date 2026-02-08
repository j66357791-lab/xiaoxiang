import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  // 基础信息
  title: { type: String, required: true },
  subtitle: { type: String }, // 👈 新增：任务小标题
  
  // 分类信息 (冗余存储，方便查询)
  categoryL1: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // 👈 一级分类
  categoryL2: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // 👈 二级分类
  categoryL3: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // 👈 三级分类 (最末级)
  
  content: { type: String, required: true },
  amount: { type: Number, required: true },
  totalSlots: { type: Number, required: true },
  appliedCount: { type: Number, default: 0 },
  
  // 状态管理
  isFrozen: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  
  // 👈 新增：定时发布相关
  scheduledAt: { type: Date },     // 定时发布时间
  isPublished: { type: Boolean, default: true }, // 是否已发布 (默认true，若有scheduledAt则初始为false)
  
  // 👈 新增：限时抢购相关
  isLimitedTime: { type: Boolean, default: false }, // 是否限时抢购
  endAt: { type: Date }, // 抢购结束时间 (自动冻结)
  
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deadline: { type: Date, required: true }, // 提交截止时间
  deadlineHours: { type: Number },
  autoFreeze: { type: Boolean, default: true },
  
  // 内容与要求
  contentImages: [{ type: String }],
  steps: [{ text: String, image: String }],
  amountLevels: [{ level: String, amount: Number }],
  
  type: { type: String, enum: ['single', 'multi'], default: 'single' },
  
  // 👈 新增：是否可重复接单 (若为false，同一个用户同一个任务只能接一次)
  isRepeatable: { type: Boolean, default: false },
  
  depositRequirement: { type: Number, default: 0 }, 
  kycRequired: { type: Boolean, default: false }    
}, {
  timestamps: true
});

// 自动处理过期和发布逻辑
JobSchema.pre('save', function(next) {
  const now = new Date();

  // 1. 检查是否到了抢购结束时间，自动冻结
  if (this.isModified('endAt') && this.endAt) {
    this.isLimitedTime = true;
  }
  
  // 2. 检查提交截止时间，自动冻结 (保留原有逻辑)
  if (this.isModified('deadline') && this.autoFreeze) {
    if (this.deadline < now) {
      this.isFrozen = true;
    }
  }

  // 3. 定时发布：如果设置了 scheduledAt 且未到时间，标记为未发布
  if (this.isModified('scheduledAt') && this.scheduledAt) {
    if (this.scheduledAt > now) {
      this.isPublished = false;
    } else {
      this.isPublished = true;
    }
  }

  next();
});

// 静态方法：定时任务执行器 (需配合 node-cron 或定时触发)
JobSchema.statics.checkStatuses = async function() {
  const now = new Date();
  
  // 1. 处理定时发布
  const jobsToPublish = await this.find({ 
    scheduledAt: { $lte: now }, 
    isPublished: false 
  });
  for (const job of jobsToPublish) {
    job.isPublished = true;
    await job.save();
    console.log(`[Job] 自动发布任务: ${job._id}`);
  }

  // 2. 处理限时抢购结束
  const jobsToEnd = await this.find({
    endAt: { $lt: now },
    isLimitedTime: true,
    isFrozen: false
  });
  for (const job of jobsToEnd) {
    job.isFrozen = true;
    await job.save();
    console.log(`[Job] 限时抢购结束，自动冻结: ${job._id}`);
  }

  // 3. 处理常规截止时间
  const jobsToFreeze = await this.find({
    deadline: { $lt: now },
    isFrozen: false,
    autoFreeze: true
  });
  for (const job of jobsToFreeze) {
    job.isFrozen = true;
    await job.save();
  }
};

export default mongoose.model('Job', JobSchema);

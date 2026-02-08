import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  
  categoryL1: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryL2: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  categoryL3: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  
  content: { type: String, required: true },
  amount: { type: Number, required: true },
  totalSlots: { type: Number, required: true },
  appliedCount: { type: Number, default: 0 },
  
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
  
  isRepeatable: { type: Boolean, default: false },
  
  depositRequirement: { type: Number, default: 0 }, 
  kycRequired: { type: Boolean, default: false }    
}, {
  timestamps: true
});

JobSchema.pre('save', function(next) {
  const now = new Date();

  if (this.isModified('endAt') && this.endAt) {
    this.isLimitedTime = true;
  }
  
  if (this.isModified('deadline') && this.autoFreeze) {
    if (this.deadline < now) {
      this.isFrozen = true;
    }
  }

  if (this.isModified('scheduledAt') && this.scheduledAt) {
    if (this.scheduledAt > now) {
      this.isPublished = false;
    } else {
      this.isPublished = true;
    }
  }

  next();
});

// 👈 修改：静态方法名改为 checkDeadlines
JobSchema.statics.checkDeadlines = async function() {
  const now = new Date();
  
  const jobsToPublish = await this.find({ 
    scheduledAt: { $lte: now }, 
    isPublished: false 
  });
  for (const job of jobsToPublish) {
    job.isPublished = true;
    await job.save();
    console.log(`[Job] 自动发布任务: ${job._id}`);
  }

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

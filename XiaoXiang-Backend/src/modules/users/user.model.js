import mongoose from 'mongoose';

/**
 * 用户数据模型
 */
const UserSchema = new mongoose.Schema({
  // 基本信息
  email: {
    type: String,
    required: [true, '邮箱不能为空'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '邮箱格式不正确']
  },
  password: {
    type: String,
    required: [true, '密码不能为空'],
    minlength: [6, '密码至少6位字符']
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superAdmin'],
    default: 'user'
  },
  
  // 资产信息
  balance: {
    type: Number,
    default: 0.00,
    min: [0, '余额不能为负数']
  },
  points: {
    type: Number,
    default: 0,
    min: [0, '积分不能为负数']
  },
  coins: {
    type: Number,
    default: 0,
    min: [0, '小象币不能为负数']
  },
  deposit: {
    type: Number,
    default: 0.00,
    min: [0, '保证金不能为负数']
  },

  // 等级与信誉系统
  exp: {
    type: Number,
    default: 0,
    min: [0, '经验值不能为负数']
  },
  level: {
    type: String,
    default: 'Lv1'
  },
  creditScore: {
    type: Number,
    default: 100,
    min: [-999, '信誉分过低'],
    max: [100, '信誉分满分为100']
  },
  creditBanUntil: {
    type: Date,
    default: null
  },

  // VIP 系统
  vipLevel: {
    type: String,
    enum: ['none', 'monthly', 'semi-annual', 'annual'],
    default: 'none'
  },
  vipExpireAt: {
    type: Date,
    default: null
  },
  vipEarningsSum: {
    type: Number,
    default: 0
  },
  
  // 团长邀请系统
  inviterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  agentRank: {
    type: Number,
    default: 1,
    min: [0, '团长等级不能为负'],
    max: [5, '团长等级最高为5']
  },
  isValidMember: {
    type: Boolean,
    default: false
  },
  validDirectCount: {
    type: Number,
    default: 0,
    min: [0, '有效直推人数不能为负']
  },
  validTeamCount: {
    type: Number,
    default: 0,
    min: [0, '团队总人数不能为负']
  },
  
  // 账户状态
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },

  // 🆕 神秘商店系统（修正缩进）
  mysteryShop: {
    level: {
      type: String,
      enum: ['novice', 'elite', 'god'],
      default: 'novice'
    },
    consumption: {
      type: Number,
      default: 0,
      min: [0, '消耗积分不能为负数']
    },
    lastDrawAt: {
      type: Date,
      default: null
    },
    totalConsumption: {
      type: Number,
      default: 0
    }
  },

  // 实名认证
  idCard: { type: String },
  idCardFront: { type: String },
  idCardBack: { type: String },
  kycStatus: {
    type: String,
    enum: ['Unverified', 'Pending', 'Verified', 'Rejected'],
    default: 'Unverified'
  },

  // 推送通知相关字段
  pushToken: {
    type: String,
    default: null
  },
  pushTokenUpdatedAt: {
    type: Date,
    default: null
  },
  notificationEnabled: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

/**
 * 更新最后登录时间
 */
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

/**
 * 密码比较
 */
UserSchema.methods.comparePassword = function(candidatePassword) {
  return this.password === candidatePassword;
};

// ==========================================
// 🆕 神秘商店静态方法
// ==========================================

/**
 * 更新神秘商店进度（原子操作，并发安全）
 */
UserSchema.statics.updateMysteryShopProgress = function(userId, amount) {
  return this.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        'mysteryShop.consumption': amount,
        'mysteryShop.totalConsumption': amount
      } 
    },
    { new: true }
  );
};

/**
 * 重置神秘商店当前进度（抽奖后调用）
 */
UserSchema.statics.resetMysteryShopProgress = function(userId) {
  return this.findByIdAndUpdate(
    userId,
    { $set: { 'mysteryShop.consumption': 0, 'mysteryShop.lastDrawAt': new Date() } },
    { new: true }
  );
};

/**
 * 切换神秘商店场阶（重置进度）
 */
UserSchema.statics.switchMysteryShopLevel = function(userId, level) {
  return this.findByIdAndUpdate(
    userId,
    { $set: { 'mysteryShop.level': level, 'mysteryShop.consumption': 0 } },
    { new: true }
  );
};

export default mongoose.model('User', UserSchema);

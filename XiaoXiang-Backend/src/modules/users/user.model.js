import mongoose from 'mongoose';

// ==========================================
// 🆕 常量配置 - 必须在 Schema 之前定义
// ==========================================

/**
 * 团队长等级配置
 */
export const TEAM_LEADER_RANKS = {
  1: {
    name: '普通会员',
    color: '#999999',
    needTeamValid: 20,
    needDirectValid: 0,
    needTeamOrders: 100,
    perOrderBonus: 0.50,
    weeklyBonusRate: 0,
    monthlyBonusRate: 0,
  },
  2: {
    name: '铜牌团长',
    color: '#CD7F32',
    needTeamValid: 200,
    needDirectValid: 100,
    needTeamOrders: 500,
    perOrderBonus: 0.50,
    weeklyBonusRate: 0,
    monthlyBonusRate: 0,
  },
  3: {
    name: '银牌团长',
    color: '#C0C0C0',
    needTeamValid: 500,
    needDirectValid: 300,
    needTeamOrders: 1000,
    perOrderBonus: 1.00,
    weeklyBonusRate: 0,
    monthlyBonusRate: 0,
  },
  4: {
    name: '金牌团长',
    color: '#FFD700',
    needTeamValid: 2000,
    needDirectValid: 800,
    needTeamOrders: 5000,
    perOrderBonus: 1.50,
    weeklyBonusRate: 0.001,  // 0.1%
    monthlyBonusRate: 0.002, // 0.2%
  },
  5: {
    name: '钻石团长',
    color: '#B9F2FF',
    needTeamValid: 8000,
    needDirectValid: 2000,
    needTeamOrders: 20000,
    perOrderBonus: 3.00,
    weeklyBonusRate: 0.002,  // 0.2%
    monthlyBonusRate: 0.008, // 0.8%
  }
};

/**
 * 新人奖励配置
 */
export const NEWBIE_REWARDS = {
  maxTotal: 88,
  kyc: { name: '实名认证奖励', amount: 2.88 },
  notification: { name: '开启消息提醒奖励', amount: 2.88 },
  payment: { name: '绑定收款方式奖励', amount: 2.88 },
  firstOrder: { name: '首单奖励', amount: 18.88 },
  secondOrder: { name: '第二单奖励', amount: 8.88 },
  subsequentOrder: { name: '后续订单奖励', amount: 2.88 },
};

/**
 * 邀请分润配置（根据下级订单数）
 */
export const INVITE_COMMISSION_TIERS = [
  { minOrders: 1, maxOrders: 10, rate: 0.08 },    // 1-10单: 8%
  { minOrders: 11, maxOrders: 50, rate: 0.10 },   // 11-50单: 10%
  { minOrders: 51, maxOrders: 200, rate: 0.12 },  // 51-200单: 12%
  { minOrders: 201, maxOrders: Infinity, rate: 0.15 }, // 201单以上: 15%
];

/**
 * 有效好友首单奖励
 */
export const FIRST_ORDER_BONUS = 8.88;

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
  // 昵称
  name: {
    type: String,
    default: '小象用户',
    trim: true,
    maxlength: [12, '昵称不能超过12个字符']
  },
  // 头像颜色
  avatarColor: {
    type: String,
    default: 'blue'
  },
  // 昵称修改相关字段（排队审核机制）
  pendingName: {
    type: String,
    default: null
  },
  nameStatus: {
    type: String,
    enum: ['idle', 'pending', 'approved', 'rejected'],
    default: 'idle'
  },
  nameUpdatedAt: {
    type: Date,
    default: null
  },
  nameRejectReason: {
    type: String,
    default: null
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
  teamOrderCount: {
    type: Number,
    default: 0,
    min: [0, '团队订单数不能为负']
  },
  // 🆕 待提现收益
  pendingEarnings: {
    type: Number,
    default: 0,
    min: [0, '待提现收益不能为负']
  },
  // 🆕 邀请收益统计
  inviteEarnings: {
    totalFromInvite: { type: Number, default: 0 },
    firstOrderBonus: { type: Number, default: 0 },
    commissionEarned: { type: Number, default: 0 },
    levelBonusEarned: { type: Number, default: 0 },
  },
  // 🆕 新人奖励状态
  newbieRewards: {
    kycReward: { type: Boolean, default: false },
    notificationReward: { type: Boolean, default: false },
    paymentReward: { type: Boolean, default: false },
    firstOrderReward: { type: Boolean, default: false },
    secondOrderReward: { type: Boolean, default: false },
    orderCount: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
  },
  // 🆕 个人订单数
  personalOrderCount: {
    type: Number,
    default: 0,
    min: [0, '订单数不能为负']
  },
  // 🆕 是否绑定收款方式
  hasValidPayment: {
    type: Boolean,
    default: false
  },
  // 🆕 团队业绩统计
  teamStats: {
    weeklyOrderAmount: { type: Number, default: 0 },
    monthlyOrderAmount: { type: Number, default: 0 },
    yearlyOrderAmount: { type: Number, default: 0 },
    lastWeekOrderAmount: { type: Number, default: 0 },
    lastMonthOrderAmount: { type: Number, default: 0 },
  },
  // 🆕 业绩奖励统计
  performanceRewards: {
    weeklyTotal: { type: Number, default: 0 },
    monthlyTotal: { type: Number, default: 0 },
    yearlyTotal: { type: Number, default: 0 },
    lastWeeklyAt: { type: Date, default: null },
    lastMonthlyAt: { type: Date, default: null },
    lastYearlyAt: { type: Date, default: null },
  },
  // 账户状态
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // 神秘商店系统
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
  realName: { type: String },
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

// 创建昵称唯一索引（防止重名）
UserSchema.index({ name: 1 }, { 
  unique: true, 
  partialFilterExpression: { 
    name: { $exists: true, $ne: '小象用户' } 
  } 
});

// ==========================================
// 实例方法
// ==========================================

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

/**
 * 获取分润金额（根据下级订单数）
 */
UserSchema.methods.getCommissionAmount = function(subordinateOrderCount) {
  for (const tier of INVITE_COMMISSION_TIERS) {
    if (subordinateOrderCount >= tier.minOrders && subordinateOrderCount <= tier.maxOrders) {
      // 基础分润：订单金额的 8-15%，这里简化为固定金额
      return 0.50; // 每单固定0.5元
    }
  }
  return 0.50;
};

/**
 * 获取等级加成
 */
UserSchema.methods.getLevelBonus = function() {
  const rankConfig = TEAM_LEADER_RANKS[this.agentRank];
  return rankConfig ? rankConfig.perOrderBonus : 0;
};

// ==========================================
// 静态方法
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
    {
      $set: {
        'mysteryShop.consumption': 0,
        'mysteryShop.lastDrawAt': new Date()
      }
    },
    { new: true }
  );
};

/**
 * 切换神秘商店场阶（重置进度）
 */
UserSchema.statics.switchMysteryShopLevel = function(userId, level) {
  return this.findByIdAndUpdate(
    userId,
    {
      $set: {
        'mysteryShop.level': level,
        'mysteryShop.consumption': 0
      }
    },
    { new: true }
  );
};

/**
 * 检查团队长升级条件
 */
UserSchema.statics.checkRankUpgrade = async function(userId) {
  const user = await this.findById(userId);
  if (!user) return null;

  const currentRank = user.agentRank;
  const nextRank = currentRank + 1;

  // 已满级
  if (nextRank > 5) {
    return {
      canUpgrade: false,
      currentRank,
      nextRank: null,
      requirements: null
    };
  }

  const nextRankConfig = TEAM_LEADER_RANKS[nextRank];
  
  // 计算有效直推人数
  const validDirectCount = await this.countDocuments({
    inviterId: userId,
    isValidMember: true
  });

  // 计算团队有效人数
  const directUsers = await this.find({ inviterId: userId }).select('_id');
  const directIds = directUsers.map(u => u._id);
  const indirectValidCount = await this.countDocuments({
    inviterId: { $in: directIds },
    isValidMember: true
  });
  const validTeamCount = validDirectCount + indirectValidCount;

  const requirements = {
    teamValid: { current: validTeamCount, need: nextRankConfig.needTeamValid },
    directValid: { current: validDirectCount, need: nextRankConfig.needDirectValid },
    teamOrders: { current: user.teamOrderCount, need: nextRankConfig.needTeamOrders },
  };

  const canUpgrade = 
    validTeamCount >= nextRankConfig.needTeamValid &&
    validDirectCount >= nextRankConfig.needDirectValid &&
    user.teamOrderCount >= nextRankConfig.needTeamOrders;

  return {
    canUpgrade,
    currentRank,
    currentRankName: TEAM_LEADER_RANKS[currentRank].name,
    nextRank,
    nextRankName: nextRankConfig.name,
    requirements,
    validTeamCount,
    validDirectCount,
    teamOrderCount: user.teamOrderCount
  };
};

/**
 * 获取团队长统计数据
 */
UserSchema.statics.getTeamLeaderStats = async function(leaderId) {
  const leader = await this.findById(leaderId);
  if (!leader) return null;

  const directMembers = await this.find({ inviterId: leaderId })
    .select('name email isValidMember personalOrderCount createdAt');
  
  const directIds = directMembers.map(m => m._id);
  const indirectMembers = await this.find({ inviterId: { $in: directIds } })
    .select('name email isValidMember personalOrderCount createdAt');

  return {
    leader: {
      id: leader._id,
      name: leader.name,
      email: leader.email,
      agentRank: leader.agentRank,
      rankName: TEAM_LEADER_RANKS[leader.agentRank]?.name || '普通会员',
    },
    stats: {
      validDirectCount: leader.validDirectCount,
      validTeamCount: leader.validTeamCount,
      teamOrderCount: leader.teamOrderCount,
      inviteEarnings: leader.inviteEarnings,
      teamStats: leader.teamStats,
      performanceRewards: leader.performanceRewards,
    },
    members: {
      direct: directMembers,
      indirect: indirectMembers,
    }
  };
};

/**
 * 获取符合周奖励条件的团队长
 */
UserSchema.statics.getEligibleForWeeklyReward = function() {
  return this.find({
    agentRank: { $gte: 4 },
    'teamStats.lastWeekOrderAmount': { $gt: 0 },
    isActive: true
  });
};

/**
 * 获取符合月奖励条件的团队长
 */
UserSchema.statics.getEligibleForMonthlyReward = function() {
  return this.find({
    agentRank: { $gte: 4 },
    'teamStats.lastMonthOrderAmount': { $gt: 0 },
    isActive: true
  });
};

// 创建模型
const User = mongoose.model('User', UserSchema);

// 默认导出模型
export default User;

import mongoose from 'mongoose';

/**
 * 矿池每日数据模型
 * 记录每天的矿池状态和计算结果
 */
const MiningPoolDaySchema = new mongoose.Schema({
  // 日期（YYYY-MM-DD格式，唯一索引）
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // ========== 投入数据 ==========
  // 今日总投入积分
  totalInvested: {
    type: Number,
    default: 0
  },
  // 今日投入用户数
  investorCount: {
    type: Number,
    default: 0
  },
  // 投入记录详情
  investments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number },
    investedAt: { type: Date }
  }],
  
  // ========== 流通数据 ==========
  // 今日流通积分（昨日流通 + 今日发行 - 今日投入）
  circulatingPoints: {
    type: Number,
    default: 1000000 // 初始基准流通
  },
  // 今日发行积分（小象币兑换产生）
  issuedPoints: {
    type: Number,
    default: 0
  },
  // 今日销毁积分（用户投入）
  burnedPoints: {
    type: Number,
    default: 0
  },
  
  // ========== 价格计算 ==========
  // 今日单价（积分/小象币）
  unitPrice: {
    type: Number,
    default: 217.6
  },
  // 今日发行小象币总量
  issuedCoins: {
    type: Number,
    default: 0
  },
  
  // ========== 系数记录 ==========
  inflationFactor: { type: Number, default: 1 },      // 通胀系数
  userFactor: { type: Number, default: 1 },           // 用户系数
  burnFactor: { type: Number, default: 1 },           // 销毁系数
  concentrationFactor: { type: Number, default: 1 },  // 集中度系数
  adminFactor: { type: Number, default: 1 },          // 管理系数
  
  // ========== 状态 ==========
  // 矿池状态：open-开放投入, locked-已锁定, calculated-已计算, distributed-已分发
  status: {
    type: String,
    enum: ['open', 'locked', 'calculated', 'distributed'],
    default: 'open'
  },
  
  // ========== 兑换价格 ==========
  // 明日兑换价格（今日锁定后计算，供明日兑换使用）
  tomorrowExchangeRate: {
    type: Number,
    default: 217.6
  },
  
  // ========== 统计 ==========
  // 涨跌幅（相对于昨日）
  priceChange: {
    type: Number,
    default: 0
  },
  priceChangePercent: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true
});

/**
 * 用户投入记录模型
 */
const UserInvestmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // 投入日期
  date: {
    type: String,
    required: true,
    index: true
  },
  
  // 投入积分数量
  amount: {
    type: Number,
    required: true
  },
  
  // 投入时间
  investedAt: {
    type: Date,
    default: Date.now
  },
  
  // 预计获得小象币（实时计算展示用）
  estimatedCoins: {
    type: Number,
    default: 0
  },
  
  // 实际获得小象币（计算后更新）
  actualCoins: {
    type: Number,
    default: 0
  },
  
  // 状态：pending-待计算, completed-已完成
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  }
  
}, {
  timestamps: true
});

// 复合索引
UserInvestmentSchema.index({ userId: 1, date: 1 });

/**
 * 价格历史模型（用于走势图）
 */
const PriceHistorySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 当日单价
  unitPrice: {
    type: Number,
    required: true
  },
  
  // 当日发行小象币
  issuedCoins: {
    type: Number,
    default: 0
  },
  
  // 当日投入积分
  totalInvested: {
    type: Number,
    default: 0
  },
  
  // 当日投入用户数
  investorCount: {
    type: Number,
    default: 0
  },
  
  // 涨跌幅
  changePercent: {
    type: Number,
    default: 0
  },
  
  // 兑换价格（次日使用）
  exchangeRate: {
    type: Number,
    default: 217.6
  }
  
}, {
  timestamps: true
});

export const MiningPoolDay = mongoose.model('MiningPoolDay', MiningPoolDaySchema);
export const UserInvestment = mongoose.model('UserInvestment', UserInvestmentSchema);
export const PriceHistory = mongoose.model('PriceHistory', PriceHistorySchema);

import mongoose from 'mongoose';
import Transaction from './Transaction.js'; // 👈 引入 Transaction 模型

const UserSchema = new mongoose.Schema({
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
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
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

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return this.password === candidatePassword;
};

UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

UserSchema.methods.addBalance = async function(amount, orderId = null, description = '余额变动') {
  // 1. 修改余额
  this.balance += amount;
  await this.save();

  // 2. 创建交易流水 (确保不可篡改)
  await Transaction.create({
    userId: this._id,
    orderId: orderId,
    type: 'income', // 假设目前主要是收入
    amount: amount,
    balanceSnapshot: this.balance, // 记录变动后的快照
    description: description
  });

  console.log(`[User] 余额变动成功: 用户 ${this.email}, 金额 ¥${amount}`);
  return this;
};

UserSchema.methods.subtractBalance = async function(amount, description = '余额扣除') {
  if (this.balance < amount) {
    throw new Error('余额不足');
  }
  this.balance -= amount;
  await this.save();

  // 提现也是一种交易记录
  await Transaction.create({
    userId: this._id,
    type: 'withdraw',
    amount: amount,
    balanceSnapshot: this.balance,
    description: description
  });

  return this;
};

// 👈 新增：获取用户统计数据（今日收益、本月收益）
UserSchema.statics.getStats = async function(userId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 计算今日收入总和
  const todayIncomeAgg = await Transaction.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        type: 'income',
        createdAt: { $gte: startOfToday }
      }
    },
    {
      $group: { _id: null, total: { $sum: "$amount" } }
    }
  ]);

  // 计算本月收入总和
  const monthIncomeAgg = await Transaction.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        type: 'income',
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: { _id: null, total: { $sum: "$amount" } }
    }
  ]);

  const dailyIncome = todayIncomeAgg.length > 0 ? todayIncomeAgg[0].total : 0;
  const monthlyIncome = monthIncomeAgg.length > 0 ? monthIncomeAgg[0].total : 0;

  return { dailyIncome, monthlyIncome };
};

export default mongoose.model('User', UserSchema);

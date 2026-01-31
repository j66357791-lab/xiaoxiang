import mongoose from 'mongoose';
import Transaction from './Transaction.js';

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
  // ================================
  // 👈 新增字段：实名与保证金
  // ================================
  deposit: {
    type: Number,
    default: 0.00,
    min: [0, '保证金不能为负数']
  },
  kycStatus: {
    type: String,
    enum: ['Unverified', 'Pending', 'Verified', 'Rejected'],
    default: 'Unverified'
  },
  idCard: {
    type: String
  },
  idCardFront: {
    type: String
  },
  idCardBack: {
    type: String
  },
  // ================================
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
  this.balance += amount;
  await this.save();

  await Transaction.create({
    userId: this._id,
    orderId: orderId,
    type: 'income',
    amount: amount,
    balanceSnapshot: this.balance,
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

  await Transaction.create({
    userId: this._id,
    type: 'withdraw',
    amount: amount,
    balanceSnapshot: this.balance,
    description: description
  });

  return this;
};

UserSchema.statics.getStats = async function(userId) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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

import mongoose from 'mongoose';

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
      delete ret.password; // 返回 JSON 时依然隐藏密码
      return ret;
    }
  }
});

// ========================================
// 修改点：删除了所有加密逻辑
// ========================================

// 简单的明文密码比对方法
UserSchema.methods.comparePassword = async function(candidatePassword) {
  // 直接比较字符串
  return this.password === candidatePassword;
};

// 更新最后登录时间
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

export default mongoose.model('User', UserSchema);

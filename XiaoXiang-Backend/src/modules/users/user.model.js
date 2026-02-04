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
  deposit: {
    type: Number,
    default: 0.00,
    min: [0, '保证金不能为负数']
  },
  
  // 账户状态
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  
  // 实名认证
  idCard: { type: String },           // 身份证号
  idCardFront: { type: String },      // 身份证正面图片
  idCardBack: { type: String },       // 身份证反面图片
  kycStatus: {
    type: String,
    // ✅ 修复：添加 'Unverified' 到枚举值
    enum: ['Unverified', 'Pending', 'Verified', 'Rejected'],
    // ✅ 修复：默认值改为 'Unverified'（新用户默认未认证）
    default: 'Unverified'
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
 * 密码比较（明文比较，实际项目应使用 bcrypt）
 */
UserSchema.methods.comparePassword = function(candidatePassword) {
  return this.password === candidatePassword;
};

export default mongoose.model('User', UserSchema);

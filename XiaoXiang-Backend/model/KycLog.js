import mongoose from 'mongoose';

const KycLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idCard: { 
    type: String, 
    required: true,
    unique: true // 👈 确保：一个身份证号只能绑定一个账号（全局唯一）
  },
  userName: String, // 用户提交的真实姓名
  frontImage: { type: String, required: true },
  backImage: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  rejectReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  auditTime: { type: Date },
  auditorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // 审核人ID
});

export default mongoose.model('KycLog', KycLogSchema);

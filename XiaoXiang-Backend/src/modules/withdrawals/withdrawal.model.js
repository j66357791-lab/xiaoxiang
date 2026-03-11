import mongoose from 'mongoose';

const WithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  paymentMethodId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
    default: 'Pending'
  },
  auditRemark: { type: String },
  requestTime: { type: Date, default: Date.now },
  auditTime: { type: Date },
  payoutTime: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model('Withdrawal', WithdrawalSchema);

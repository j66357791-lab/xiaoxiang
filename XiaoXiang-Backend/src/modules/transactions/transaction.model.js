import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  type: { 
    type: String, 
    enum: ['income', 'withdraw', 'recharge', 'commission'], 
    required: true 
  },
  amount: { type: Number, required: true },
  balanceSnapshot: { type: Number, required: true },
  description: { type: String },
  status: { type: String, enum: ['completed', 'pending'], default: 'completed' }
}, {
  timestamps: true
});

export default mongoose.model('Transaction', TransactionSchema);

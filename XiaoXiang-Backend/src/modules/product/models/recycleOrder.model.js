import mongoose from 'mongoose';

const RecycleOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecycleTask', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String },
  quantity: { type: Number, default: 1 },
  recyclePrice: { type: Number, required: true },
  userProfit: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'received', 'bound', 'approved', 'settled', 'completed', 'cancelled'],
    default: 'pending'
  },
  saleBindInfo: {
    platformName: { type: String },
    platformOrderNo: { type: String },
    salePrice: { type: Number },
    bindAt: { type: Date },
    bindBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  settleDeadline: { type: Date },
  settledAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('RecycleOrder', RecycleOrderSchema);

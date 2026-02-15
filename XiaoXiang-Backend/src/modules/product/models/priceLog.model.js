import mongoose from 'mongoose';

const PriceLogSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  before: { purchasePrice: Number, salePrice: Number, profit: Number },
  after: { purchasePrice: Number, salePrice: Number, profit: Number },
  reason: { type: String, default: '更新价格' }
}, { timestamps: true });

export default mongoose.model('PriceLog', PriceLogSchema);

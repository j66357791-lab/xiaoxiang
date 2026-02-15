import mongoose from 'mongoose';

const DailyReportSchema = new mongoose.Schema({
  reportDate: { type: Date, required: true, unique: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderStats: { total: Number, completed: Number, cancelled: Number },
  financialStats: { totalIncome: Number, totalCost: Number, totalProfit: Number, totalSettled: Number, pendingSettle: Number },
  stockChanges: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, productName: String, change: Number, reason: String }],
}, { timestamps: true });

export default mongoose.model('DailyReport', DailyReportSchema);

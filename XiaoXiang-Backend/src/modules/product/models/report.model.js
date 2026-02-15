import mongoose from 'mongoose';

const DailyReportSchema = new mongoose.Schema({
  reportDate: { type: Date, required: true, unique: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  orderStats: {
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
  },
  
  financialStats: {
    totalIncome: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalSettled: { type: Number, default: 0 },
    pendingSettle: { type: Number, default: 0 },
  },
  
  stockChanges: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    change: Number,
    reason: String
  }],
}, { timestamps: true });

export default mongoose.model('DailyReport', DailyReportSchema);

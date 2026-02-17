import mongoose from 'mongoose';

// 夜审记录模型
const NightAuditSchema = new mongoose.Schema({
  // 审计日期
  date: { 
    type: String, 
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/  // YYYY-MM-DD格式
  },
  
  // 库存变动
  stockIn: { type: Number, default: 0 },          // 进货入库数量
  stockOut: { type: Number, default: 0 },         // 出库数量
  stockChange: [{                                  // 库存变动明细
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    skuId: mongoose.Schema.Types.ObjectId,
    skuName: String,
    quantity: Number,
    type: { type: String, enum: ['in', 'out'] },
    reason: String
  }],
  
  // 财务统计
  salesAmount: { type: Number, default: 0 },       // 销售金额
  purchaseCost: { type: Number, default: 0 },      // 进货成本
  productProfit: { type: Number, default: 0 },     // 商品利润
  platformIncome: { type: Number, default: 0 },    // 平台收入
  userProfit: { type: Number, default: 0 },        // 用户收益
  
  // 订单统计
  orderCount: { type: Number, default: 0 },        // 新增订单数
  completedCount: { type: Number, default: 0 },    // 完成订单数
  cancelledCount: { type: Number, default: 0 },    // 取消订单数
  pendingPaymentCount: { type: Number, default: 0 }, // 待打款订单数
  pendingPaymentAmount: { type: Number, default: 0 }, // 待打款金额
  
  // 预警统计
  stockWarningCount: { type: Number, default: 0 }, // 库存预警数量
  fundWarningCount: { type: Number, default: 0 },  // 资金预警数量
  warnings: [{                                      // 预警明细
    type: { type: String, enum: ['stock', 'fund'] },
    severity: { type: String, enum: ['warning', 'danger'] },
    message: String,
    details: mongoose.Schema.Types.Mixed
  }],
  
  // 资金情况
  availableFund: { type: Number, default: 0 },     // 可用资金
  fundGap: { type: Number, default: 0 },           // 资金缺口
  
  // 执行状态
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  
  // 执行信息
  startedAt: { type: Date },
  completedAt: { type: Date },
  duration: { type: Number },                       // 执行时长（毫秒）
  error: String,
  
  // 执行人（手动执行时）
  executedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, { timestamps: true });

// 索引
NightAuditSchema.index({ date: -1 });
NightAuditSchema.index({ status: 1 });

// 静态方法：获取今日审计
NightAuditSchema.statics.getTodayAudit = async function() {
  const today = new Date().toISOString().split('T')[0];
  return await this.findOne({ date: today });
};

// 静态方法：获取审计历史
NightAuditSchema.statics.getHistory = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  return await this.find({
    date: { $gte: startDateStr },
    status: 'completed'
  }).sort({ date: -1 });
};

// 静态方法：执行夜审
NightAuditSchema.statics.executeAudit = async function(executedBy = null) {
  const today = new Date().toISOString().split('T')[0];
  
  // 检查今日是否已执行
  const existing = await this.findOne({ date: today, status: 'completed' });
  if (existing) {
    throw new Error('今日夜审已执行');
  }
  
  // 创建或获取审计记录
  let audit = await this.findOne({ date: today });
  if (!audit) {
    audit = new this({ date: today });
  }
  
  audit.status = 'running';
  audit.startedAt = new Date();
  if (executedBy) audit.executedBy = executedBy;
  await audit.save();
  
  try {
    const Product = mongoose.model('Product');
    const Order = mongoose.model('Order');
    const OrderBind = mongoose.model('OrderBind');
    const StockLog = mongoose.model('StockLog');
    
    // 1. 统计库存变动
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(today + 'T23:59:59.999Z');
    
    const stockLogs = await StockLog.find({
      createdAt: { $gte: todayStart, $lte: todayEnd },
      module: 'stock'
    });
    
    let stockIn = 0;
    let stockOut = 0;
    const stockChange = [];
    
    stockLogs.forEach(log => {
      const diff = log.changes?.diff || 0;
      if (diff > 0) {
        stockIn += diff;
      } else {
        stockOut += Math.abs(diff);
      }
      
      stockChange.push({
        productId: log.targetId,
        productName: log.targetName,
        quantity: Math.abs(diff),
        type: diff > 0 ? 'in' : 'out',
        reason: log.reason
      });
    });
    
    audit.stockIn = stockIn;
    audit.stockOut = stockOut;
    audit.stockChange = stockChange;
    
    // 2. 统计订单
    const orders = await Order.find({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    
    audit.orderCount = orders.length;
    audit.completedCount = orders.filter(o => o.status === 'Completed').length;
    audit.cancelledCount = orders.filter(o => o.status === 'Cancelled').length;
    
    // 待打款统计
    const pendingPaymentOrders = await Order.find({
      status: 'PendingPayment'
    });
    audit.pendingPaymentCount = pendingPaymentOrders.length;
    audit.pendingPaymentAmount = pendingPaymentOrders.reduce((sum, o) => 
      sum + (o.settleAmount || o.jobSnapshot?.amount || 0), 0
    );
    
    // 3. 统计绑定和利润
    const binds = await OrderBind.find({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    
    audit.salesAmount = binds.reduce((sum, b) => 
      sum + (b.actualSalePrice || b.salePrice || 0), 0
    );
    audit.purchaseCost = binds.reduce((sum, b) => sum + (b.purchasePrice || 0), 0);
    audit.productProfit = binds.reduce((sum, b) => sum + (b.productProfit || 0), 0);
    audit.platformIncome = binds.reduce((sum, b) => sum + (b.platformIncome || 0), 0);
    audit.userProfit = binds.reduce((sum, b) => sum + (b.userProfit || 0), 0);
    
    // 4. 库存预警
    const warnings = await Product.getWarningProducts();
    audit.stockWarningCount = warnings.length;
    
    audit.warnings = warnings.map(w => ({
      type: 'stock',
      severity: w.severity,
      message: `${w.productName} - ${w.skuName} 库存不足`,
      details: w
    }));
    
    // 5. 资金预警
    audit.availableFund = audit.salesAmount - audit.pendingPaymentAmount;
    audit.fundGap = Math.max(0, audit.pendingPaymentAmount - audit.availableFund);
    
    if (audit.fundGap > 0) {
      audit.fundWarningCount = 1;
      audit.warnings.push({
        type: 'fund',
        severity: audit.fundGap > 5000 ? 'danger' : 'warning',
        message: `资金缺口 ¥${audit.fundGap.toFixed(2)}`,
        details: {
          pendingPayment: audit.pendingPaymentAmount,
          availableFund: audit.availableFund,
          fundGap: audit.fundGap
        }
      });
    }
    
    // 完成
    audit.status = 'completed';
    audit.completedAt = new Date();
    audit.duration = audit.completedAt - audit.startedAt;
    await audit.save();
    
    return audit;
    
  } catch (error) {
    audit.status = 'failed';
    audit.error = error.message;
    audit.completedAt = new Date();
    audit.duration = audit.completedAt - audit.startedAt;
    await audit.save();
    throw error;
  }
};

export default mongoose.model('NightAudit', NightAuditSchema);

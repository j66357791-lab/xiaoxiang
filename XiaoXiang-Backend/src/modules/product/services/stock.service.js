import Product from '../models/product.model.js';
import OrderBind from '../models/orderBind.model.js';
import StockLog from '../models/stockLog.model.js';
import Order from '../../orders/order.model.js';
import mongoose from 'mongoose';

// ==================== 库存服务 ====================

/**
 * 调整SKU库存
 */
export const adjustSkuStock = async (productId, skuId, quantity, reason, user) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('商品不存在');
  
  const result = product.adjustSkuStock(skuId, quantity, reason);
  await product.save();
  
  // 记录日志
  await StockLog.create({
    module: 'stock',
    action: quantity > 0 ? 'stock_in' : 'stock_out',
    targetId: product._id,
    targetName: `${product.name} - ${result.sku.name}`,
    changes: {
      before: result.beforeStock,
      after: result.afterStock,
      diff: quantity
    },
    reason,
    operator: {
      id: user._id,
      name: user.name,
      role: user.role
    }
  });
  
  return {
    product,
    sku: result.sku,
    beforeStock: result.beforeStock,
    afterStock: result.afterStock
  };
};

/**
 * 批量调整库存
 */
export const batchAdjustStock = async (adjustments, user) => {
  const results = [];
  
  for (const adj of adjustments) {
    const result = await adjustSkuStock(
      adj.productId,
      adj.skuId,
      adj.quantity,
      adj.reason,
      user
    );
    results.push(result);
  }
  
  return results;
};

/**
 * 绑定订单到库存
 */
export const bindOrderToStock = async (orderId, bindData, user) => {
  // 检查订单是否存在
  const order = await Order.findById(orderId);
  if (!order) throw new Error('订单不存在');
  
  // 检查是否已绑定
  const existingBind = await OrderBind.findOne({ orderId });
  if (existingBind) throw new Error('订单已绑定');
  
  // 检查商品和SKU
  const product = await Product.findById(bindData.productId);
  if (!product) throw new Error('商品不存在');
  
  const sku = product.skus.id(bindData.skuId);
  if (!sku) throw new Error('规格不存在');
  
  // 检查库存是否足够
  if (sku.currentStock < 1) {
    throw new Error('库存不足，无法绑定');
  }
  
  // 创建绑定记录
  const bind = new OrderBind({
    orderId,
    orderNumber: order.orderNumber,
    productId: bindData.productId,
    productName: product.name,
    skuId: bindData.skuId,
    skuName: sku.name,
    purchasePrice: sku.purchasePrice,
    salePrice: sku.salePrice,
    actualSalePrice: bindData.actualSalePrice || sku.salePrice,
    settleAmount: order.settleAmount || order.jobSnapshot?.amount || 0,
    externalPlatform: bindData.externalPlatform || '',
    externalOrderNo: bindData.externalOrderNo || '',
    remark: bindData.remark || '',
    isCompleted: bindData.isCompleted || false,
    bindBy: user._id
  });
  
  await bind.save();
  
  // 扣减库存
  const result = product.adjustSkuStock(bindData.skuId, -1, '订单绑定');
  await product.save();
  
  // 记录日志
  await StockLog.create({
    module: 'order',
    action: 'bind',
    targetId: order._id,
    targetName: `${product.name} - ${sku.name}`,
    changes: {
      before: result.beforeStock,
      after: result.afterStock,
      diff: -1
    },
    reason: `订单绑定: ${order.orderNumber}`,
    operator: {
      id: user._id,
      name: user.name,
      role: user.role
    }
  });
  
  // 如果勾选了完结订单
  if (bindData.isCompleted && order.status !== 'Applied') {
    order.status = 'PendingPayment';
    order.pendingPaymentAt = new Date();
    await order.save();
    bind.isCompleted = true;
    bind.completedAt = new Date();
    await bind.save();
  }
  
  return bind;
};

/**
 * 取消订单绑定（回滚库存）
 */
export const unbindOrder = async (orderId, user) => {
  const bind = await OrderBind.findOne({ orderId });
  if (!bind) throw new Error('绑定记录不存在');
  
  if (bind.status === 'cancelled') {
    throw new Error('绑定已取消');
  }
  
  // 恢复库存
  const product = await Product.findById(bind.productId);
  if (product) {
    const result = product.adjustSkuStock(bind.skuId, 1, '取消绑定');
    await product.save();
    
    // 记录日志
    await StockLog.create({
      module: 'order',
      action: 'unbind',
      targetId: orderId,
      targetName: `${product.name} - ${bind.skuName}`,
      changes: {
        before: result.beforeStock,
        after: result.afterStock,
        diff: 1
      },
      reason: '取消订单绑定',
      operator: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });
  }
  
  // 更新绑定状态
  bind.status = 'cancelled';
  await bind.save();
  
  return bind;
};

/**
 * 获取库存预警
 */
export const getStockWarnings = async () => {
  return await Product.getWarningProducts();
};

/**
 * 获取资金预警
 */
export const getFundWarnings = async () => {
  // 获取待打款金额
  const pendingPaymentOrders = await Order.find({ status: 'PendingPayment' });
  const pendingPaymentAmount = pendingPaymentOrders.reduce((sum, o) => 
    sum + (o.settleAmount || o.jobSnapshot?.amount || 0), 0
  );
  
  // 获取已售出但未结算的金额
  const binds = await OrderBind.find({ status: 'bound' });
  const totalSalePrice = binds.reduce((sum, b) => 
    sum + (b.actualSalePrice || b.salePrice || 0), 0
  );
  const totalSettle = binds.reduce((sum, b) => sum + (b.settleAmount || 0), 0);
  
  const availableFund = totalSalePrice - totalSettle;
  const fundGap = Math.max(0, pendingPaymentAmount - availableFund);
  
  if (fundGap > 0) {
    return {
      hasWarning: true,
      severity: fundGap > 5000 ? 'danger' : 'warning',
      pendingPayment: pendingPaymentAmount,
      availableFund,
      fundGap,
      pendingPaymentCount: pendingPaymentOrders.length
    };
  }
  
  return {
    hasWarning: false,
    pendingPayment: pendingPaymentAmount,
    availableFund,
    fundGap: 0,
    pendingPaymentCount: pendingPaymentOrders.length
  };
};

/**
 * 获取库存统计
 */
export const getStockStats = async (categoryId = null) => {
  return await Product.getStockStats(categoryId);
};

/**
 * 获取绑定统计
 */
export const getBindStats = async (startDate, endDate) => {
  return await OrderBind.getBindStats(startDate, endDate);
};

/**
 * 获取待绑定订单
 */
export const getPendingBindOrders = async () => {
  return await OrderBind.getPendingOrders();
};

export default {
  adjustSkuStock,
  batchAdjustStock,
  bindOrderToStock,
  unbindOrder,
  getStockWarnings,
  getFundWarnings,
  getStockStats,
  getBindStats,
  getPendingBindOrders
};

// src/modules/asset/asset.service.js
import Asset from './asset.model.js';
import mongoose from 'mongoose';

export class AssetService {
  
  /**
   * 创建资产 (由订单完成时自动调用)
   */
  static async createAssetFromOrder(order) {
    if (!order || !order._id) throw new Error('订单数据无效');

    // 防止重复创建
    const exists = await Asset.findOne({ orderId: order._id });
    if (exists) return exists;

    // 映射数据
    const asset = new Asset({
      orderId: order._id,
      userId: order.userId,
      productName: order.jobSnapshot?.title || '未知资产',
      userName: order.userId?.email || '未知用户', // 注意：order.userId 如果是 populate 后的对象才有 email
      costPrice: order.jobSnapshot?.amount || 0,
      status: 'Stocked',
      stockDays: 0
    });

    await asset.save();
    return asset;
  }

  /**
   * 获取资产列表
   */
  static async getAssets(query = {}) {
    const { status, keyword, page = 1, limit = 20 } = query;
    const filter = {};
    
    if (status) filter.status = status;
    if (keyword) filter.productName = { $regex: keyword, $options: 'i' };

    const assets = await Asset.find(filter)
      .populate('userId', 'email profile.name') // 确保获取用户信息
      .populate('orderId', 'orderNumber status') // 获取订单编号
      .sort({ isShelved: -1, createdAt: -1 }) // 搁置的排前面
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Asset.countDocuments(filter);
    
    // 计算实时的库存天数
    const now = new Date();
    const formattedAssets = assets.map(asset => {
      const obj = asset.toObject();
      obj.stockDays = Math.floor((now - new Date(obj.createdAt)) / (1000 * 60 * 60 * 24));
      // 兼容前端需要的 id 字段
      obj.id = obj._id;
      return obj;
    });

    return { assets: formattedAssets, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 更新处置信息
   */
  static async updateDisposal(assetId, data, adminId) {
    const asset = await Asset.findById(assetId).populate('orderId');
    if (!asset) throw new Error('资产不存在');

    // 1. 更新资产数据 (直接赋值，前端传什么存什么)
    const fields = [
      'soldPrice', 'resalePlatform', 'resaleOrderNo', 
      'shippingNeeded', 'shippingCost', 'trackingNo', 
      'otherCostAmount', 'otherCostRemark', 'remark'
    ];
    
    fields.forEach(field => {
      if (data[field] !== undefined) {
        asset[field] = data[field];
      }
    });

    // 2. 处理状态联动
    let orderStatusTarget = null;

    if (data.disposeAction === '确定售卖') {
      asset.status = 'Disposed'; // 前端 DISPOSED 状态
      asset.disposeAction = '确定售卖';
      asset.disposedAt = new Date();
    } 
    else if (data.disposeAction === '确定结算') {
      asset.status = 'Disposed';
      asset.disposeAction = '确定结算';
      asset.disposedAt = new Date();
      orderStatusTarget = 'PendingPayment'; // 触发订单 -> 待打款
    } 
    else if (data.disposeAction === '确定完结') {
      asset.status = 'Disposed';
      asset.disposeAction = '确定完结';
      asset.disposedAt = new Date();
      orderStatusTarget = 'Completed'; // 触发订单 -> 已完结 (发钱)
    }

    await asset.save();

    // 3. 联动更新订单状态
    if (orderStatusTarget && asset.orderId) {
      const { OrderService } = await import('../orders/order.service.js');
      
      console.log(`[AssetService] 联动更新订单状态: ${asset.orderId.orderNumber} -> ${orderStatusTarget}`);
      
      await OrderService.updateOrderStatus(asset.orderId._id, orderStatusTarget, {
        reviewedBy: adminId,
        reason: `资产处置联动: ${data.disposeAction}`
      });
    }

    return asset;
  }
}

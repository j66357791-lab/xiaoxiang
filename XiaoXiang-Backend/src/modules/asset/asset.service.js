// src/modules/asset/asset.service.js
import Asset from './asset.model.js';
import mongoose from 'mongoose';
import Order from '../orders/order.model.js'; // 引入订单模型

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
      userName: order.userId?.email || '未知用户',
      costPrice: order.jobSnapshot?.amount || 0,
      status: 'Stocked',
      stockDays: 0
    });

    await asset.save();
    return asset;
  }

  /**
   * 🔥 新增：从历史订单同步资产
   */
  static async syncAssetsFromOrders() {
    const TARGET_CATEGORY_NAME = '回收分类';

    // 1. 查找所有未取消的订单，并关联用户信息
    const orders = await Order.find({ status: { $ne: 'Cancelled' } })
      .populate('userId', 'email profile.name'); 
    // ✅ 修复：删除了 .populate('jobSnapshot.category')

    let addedCount = 0;
    let skipCount = 0;

    for (const order of orders) {
      // 2. 前端原有的过滤逻辑：分类名匹配 或 标题包含"回收"
      const categoryName = order.jobSnapshot?.category?.name || '';
      const title = order.jobSnapshot?.title || '';
      
      const isRecycleOrder = categoryName === TARGET_CATEGORY_NAME || title.includes('回收');

      if (!isRecycleOrder) continue; // 不符合条件跳过

      // 3. 防止重复：检查是否已经存在
      const exists = await Asset.findOne({ orderId: order._id });
      if (exists) {
        skipCount++;
        continue;
      }

      // 4. 创建资产数据
      await Asset.create({
        orderId: order._id,
        userId: order.userId?._id || order.userId, 
        productName: title || '未知资产',
        userName: order.userId?.email || '未知用户',
        costPrice: order.jobSnapshot?.amount || 0,
        status: order.status === 'Completed' ? 'Disposed' : 'Stocked', 
        createdAt: order.createdAt // 继承订单创建时间
      });
      addedCount++;
    }

    return { message: `同步完成，新增: ${addedCount}，跳过已存在: ${skipCount}` };
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
      .populate('userId', 'email profile.name') 
      .populate('orderId', 'orderNumber status') 
      .sort({ isShelved: -1, createdAt: -1 }) 
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Asset.countDocuments(filter);
    
    const now = new Date();
    const formattedAssets = assets.map(asset => {
      const obj = asset.toObject();
      obj.stockDays = Math.floor((now - new Date(obj.createdAt)) / (1000 * 60 * 60 * 24));
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

    let orderStatusTarget = null;

    if (data.disposeAction === '确定售卖') {
      asset.status = 'Disposed'; 
      asset.disposeAction = '确定售卖';
      asset.disposedAt = new Date();
    } 
    else if (data.disposeAction === '确定结算') {
      asset.status = 'Disposed';
      asset.disposeAction = '确定结算';
      asset.disposedAt = new Date();
      orderStatusTarget = 'PendingPayment'; 
    } 
    else if (data.disposeAction === '确定完结') {
      asset.status = 'Disposed';
      asset.disposeAction = '确定完结';
      asset.disposedAt = new Date();
      orderStatusTarget = 'Completed'; 
    }

    await asset.save();

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

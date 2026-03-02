// src/modules/asset/asset.controller.js
import Asset from './asset.model.js';
import Order from '../orders/order.model.js';

// 允许录入资产的订单状态
const VALID_ASSET_ORDER_STATUSES = ['Completed', 'PendingPayment'];

/**
 * 从订单创建资产
 */
export const createFromOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: '缺少订单ID' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });

    if (!VALID_ASSET_ORDER_STATUSES.includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `订单状态为 ${order.status}，仅 ${VALID_ASSET_ORDER_STATUSES.join('、')} 状态的订单可录入资产` 
      });
    }

    const exists = await Asset.findOne({ order: orderId });
    if (exists) return res.json({ success: true, message: '该订单已录入', data: exists });

    const newAsset = await Asset.create({
      order: order._id,
      user: order.userId,
      name: order.jobSnapshot?.title || '未知资产',
      costPrice: order.jobSnapshot?.amount || 0,
      status: 'InStock',
    });

    await Order.findByIdAndUpdate(orderId, {
      assetCreated: true,
      assetId: newAsset._id
    });

    res.json({ success: true, message: '录入成功', data: newAsset });
  } catch (error) {
    console.error('[Asset] 创建失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

/**
 * 获取资产列表
 * 🔥 关键：必须 populate order 才能获取订单号
 */
export const getAssets = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const assets = await Asset.find(filter)
      .populate('user', 'email name')
      .populate('order', 'orderNumber status')  // 🔥 必须有这一行
      .sort({ createdAt: -1 }); 

    res.json({ success: true, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取列表失败' });
  }
};

/**
 * 更新资产
 */
export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.soldPrice !== undefined || updateData.disposeAction) {
      updateData.disposedAt = new Date();
      updateData.status = 'Disposed';
    }

    const updatedAsset = await Asset.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!updatedAsset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    res.json({ success: true, message: '更新成功', data: updatedAsset });
  } catch (error) {
    console.error('[Asset] 更新失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
};

/**
 * 资产回退
 */
export const revertAsset = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const resetData = {
      status: 'InStock',
      disposeAction: null,
      soldPrice: null,
      resalePlatform: null,
      resaleOrderNo: null,
      trackingNo: null,
      disposedAt: null,
      isShelved: false,
      shippingNeeded: false,
      shippingCost: 0,
      otherCostAmount: 0,
      otherCostRemark: null,
    };

    const updatedAsset = await Asset.findByIdAndUpdate(id, resetData, { new: true });

    res.json({ 
      success: true, 
      message: '资产已回退至压货状态', 
      data: updatedAsset 
    });
  } catch (error) {
    console.error('[Asset] 回退失败:', error);
    res.status(500).json({ success: false, message: '回退失败' });
  }
};

/**
 * 删除失效订单对应的资产
 */
export const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await Asset.findById(id).populate('order', 'status');
    if (!asset) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const orderStatus = asset.order?.status;
    if (!['Cancelled', 'Rejected'].includes(orderStatus)) {
      return res.status(400).json({ 
        success: false, 
        message: '仅允许删除已取消或已驳回订单对应的资产' 
      });
    }

    await Asset.findByIdAndDelete(id);

    if (asset.order?._id) {
      await Order.findByIdAndUpdate(asset.order._id, {
        assetCreated: false,
        assetId: null
      });
    }

    res.json({ success: true, message: '资产已删除' });
  } catch (error) {
    console.error('[Asset] 删除失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
};

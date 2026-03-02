import Asset from './asset.model.js';
import Order from '../orders/order.model.js';

/**
 * 从订单创建资产 (只执行一次，生成初始记录)
 */
export const createFromOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: '缺少订单ID' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    if (order.status === 'Cancelled') return res.status(400).json({ success: false, message: '已取消订单不可录入' });

    // 幂等性检查
    const exists = await Asset.findOne({ order: orderId });
    if (exists) return res.json({ success: true, message: '该订单已录入', data: exists });

    const newAsset = await Asset.create({
      order: order._id,
      user: order.userId,
      name: order.jobSnapshot?.title || '未知资产',
      costPrice: order.jobSnapshot?.amount || 0,
      status: 'InStock',
    });

    res.json({ success: true, message: '录入成功', data: newAsset });
  } catch (error) {
    console.error('[Asset] 创建失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

/**
 * 获取资产列表
 */
export const getAssets = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    // 🔥 关键：联表查询，获取订单号和用户信息
    const assets = await Asset.find(filter)
      .populate('user', 'email name')        // 获取用户邮箱
      .populate('order', 'orderNumber status') // 获取订单号和状态
      .sort({ createdAt: -1 }); 

    res.json({ success: true, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取列表失败' });
  }
};


/**
 * 更新资产 (处置/编辑)
 * 接收前端 DisposeModal 的所有字段
 */
export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 如果前端传了 soldPrice 或 disposeAction，说明是处置操作，记录时间
    if (updateData.soldPrice || updateData.disposeAction) {
      updateData.disposedAt = new Date();
      updateData.status = 'Disposed'; // 标记为已处置
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

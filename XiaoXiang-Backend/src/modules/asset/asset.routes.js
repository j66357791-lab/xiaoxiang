// src/modules/asset/asset.routes.js
import express from 'express';
import Asset from './asset.model.js';
import mongoose from 'mongoose';
import { authenticate } from '../../common/middlewares/auth.js';

const router = express.Router();

// 🛡️ 辅助函数：安全转换 ID
const toObjectId = (id) => {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (e) {
    return null;
  }
};

// ==================== 🆕 1. 安全检查接口 ====================
router.post('/check', authenticate, async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds)) {
      return res.status(400).json({ success: false, message: 'orderIds 必须是数组' });
    }

    const objectIds = orderIds.map(id => toObjectId(id)).filter(id => id);
    const existingAssets = await Asset.find({ order: { $in: objectIds } }).select('order');

    const existingIds = existingAssets.map(a => a.order.toString());

    res.json({ 
      success: true, 
      data: { 
        existingIds, 
        count: existingIds.length 
      } 
    });
  } catch (error) {
    console.error('[Asset] 检查失败:', error);
    res.status(500).json({ success: false, message: '检查失败' });
  }
});

// ==================== 2. 创建/更新资产 (Upsert) ====================
router.post('/', authenticate, async (req, res) => {
  try {
    const { order, user, name, costPrice, archivedAt, archiveRemark } = req.body;

    const orderId = toObjectId(order);
    if (!orderId) {
      return res.status(400).json({ success: false, message: '无效的订单ID' });
    }

    const userId = toObjectId(user);

    const updateData = {
      user: userId,
      name,
      costPrice,
      archivedAt: archivedAt || new Date(),
      archiveRemark: archiveRemark || ''
    };

    const savedAsset = await Asset.findOneAndUpdate(
      { order: orderId }, 
      updateData, 
      { 
        new: true,       
        upsert: true,    
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({ 
      success: true, 
      data: savedAsset, 
      message: '存档成功' 
    });

  } catch (error) {
    console.error('[Asset] 存档失败:', error);
    if (error.code === 11000) {
       return res.status(200).json({ success: true, message: '数据重复，已处理' });
    }
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 3. 获取资产列表 ====================
router.get('/', authenticate, async (req, res) => {
  try {
    const assets = await Asset.find()
      .populate('order', 'orderNumber status jobSnapshot')
      .populate('user', 'email username')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('[Asset] 查询失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 4. 更新资产 ====================
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.order; // 禁止修改 order

    if (updates.status === 'Disposed' && !updates.disposedAt) {
      updates.disposedAt = new Date();
    }

    const updatedAsset = await Asset.findByIdAndUpdate(id, updates, { new: true });
    
    if (!updatedAsset) {
      return res.status(404).json({ success: false, message: '资产未找到' });
    }

    res.json({ success: true, data: updatedAsset });
  } catch (error) {
    console.error('[Asset] 更新失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 5. 删除资产
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await Asset.findByIdAndDelete(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

export default router;

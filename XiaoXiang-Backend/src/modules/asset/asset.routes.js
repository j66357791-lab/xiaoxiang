// src/modules/asset/asset.routes.js
import express from 'express';
import Asset from './asset.model.js';

// 🔥 修正：引入名为 'authenticate' 的中间件
import { authenticate } from '../../common/middlewares/auth.js'; 

const router = express.Router();

// 🔥 1. 创建资产 (前端同步逻辑调用此接口)
router.post('/', authenticate, async (req, res) => {
  try {
    const assetData = req.body;
    
    const newAsset = new Asset(assetData);
    await newAsset.save();
    
    res.status(201).json({ success: true, data: newAsset });
  } catch (error) {
    // 如果是唯一键冲突，说明已存在，直接返回成功
    if (error.code === 11000) {
      return res.status(200).json({ 
        success: true, 
        message: '该订单已存在资产库中' 
      });
    }
    
    console.error('[Asset] 创建失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 🔥 2. 获取资产列表
router.get('/', authenticate, async (req, res) => {
  try {
    const assets = await Asset.find()
      .populate('order', 'orderNumber status jobSnapshot') // 关联订单信息
      .populate('user', 'email username')                  // 关联用户信息
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('[Asset] 查询失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 🔥 3. 更新资产
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 如果是处置操作，自动记录处置时间
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

// 4. 删除资产
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

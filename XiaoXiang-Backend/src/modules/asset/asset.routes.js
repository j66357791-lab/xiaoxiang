// src/modules/asset/asset.routes.js
import express from 'express';
import Asset from './asset.model.js';
// 引入你的认证中间件 (路径根据你的实际项目调整，一般在 common 或 auth 模块)
import { protect } from '../../common/middlewares/auth.js'; 

const router = express.Router();

// 🔥 1. 创建资产 (前端同步逻辑调用此接口)
router.post('/', protect, async (req, res) => {
  try {
    // 前端传来的数据: { order, user, name, costPrice }
    const assetData = req.body;
    
    const newAsset = new Asset(assetData);
    await newAsset.save();
    
    res.status(201).json({ success: true, data: newAsset });
  } catch (error) {
    // 🚨 关键：如果是唯一键冲突 (代码 11000)，说明该订单已录入
    // 我们不报错，而是返回成功，告诉前端“已存在”
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
router.get('/', protect, async (req, res) => {
  try {
    // 查询资产，并关联查询订单和用户信息
    const assets = await Asset.find()
      .populate('order', 'orderNumber status jobSnapshot') // 关联订单，获取订单号和状态
      .populate('user', 'email username')                  // 关联用户
      .sort({ createdAt: -1 }); // 按创建时间倒序

    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('[Asset] 查询失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 🔥 3. 更新资产 (用于处置、搁置等操作)
router.put('/:id', protect, async (req, res) => {
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
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    await Asset.findByIdAndDelete(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

export default router;

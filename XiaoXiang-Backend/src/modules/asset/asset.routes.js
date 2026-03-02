// src/modules/asset/asset.routes.js
import express from 'express';
import Asset from './asset.model.js';
import mongoose from 'mongoose'; // 🆕 引入 mongoose 用于校验 ID
import { auth } from '../../common/middlewares/auth.js'; 

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
// 前端在存档前调用，返回哪些订单已经在资产库中
router.post('/check', auth, async (req, res) => {
  try {
    const { orderIds } = req.body; // 期望前端传一个 ID 数组
    
    if (!Array.isArray(orderIds)) {
      return res.status(400).json({ success: false, message: 'orderIds 必须是数组' });
    }

    // 查询这些订单ID在资产库中是否存在
    const objectIds = orderIds.map(id => toObjectId(id)).filter(id => id);
    const existingAssets = await Asset.find({ order: { $in: objectIds } }).select('order');
    
    // 提取已存在的订单 ID
    const existingIds = existingAssets.map(a => a.order.toString());

    res.json({ 
      success: true, 
      data: { 
        existingIds, // 已存在的 ID 列表
        count: existingIds.length 
      } 
    });
  } catch (error) {
    console.error('[Asset] 检查失败:', error);
    res.status(500).json({ success: false, message: '检查失败' });
  }
});

// ==================== 2. 创建/更新资产 (Upsert 逻辑) ====================
router.post('/', auth, async (req, res) => {
  try {
    const { order, user, name, costPrice, status, archivedAt, archiveRemark } = req.body;

    // 🛡️ 安全校验：必须包含订单ID
    const orderId = toObjectId(order);
    if (!orderId) {
      return res.status(400).json({ success: false, message: '无效的订单ID' });
    }

    // 🛡️ 安全校验：用户ID格式
    const userId = toObjectId(user);
    // 如果 user 必填，这里可以拦截
    // if (!userId) return res.status(400).json({ success: false, message: '无效的用户ID' });

    // 🔥 关键逻辑：Upsert
    // 如果该 order 已存在：更新它的 name, costPrice, archivedAt 等信息 (修复脏数据)
    // 如果该 order 不存在：创建一条新数据
    const updateData = {
      user: userId,       // 更新用户关联
      name: name,         // 🔥 强制更新名称，修复之前的空名称问题
      costPrice: costPrice, // 🔥 强制更新价格
      archivedAt: archivedAt || new Date(),
      archiveRemark: archiveRemark || ''
      // 注意：这里我们不更新 status，防止覆盖已处置的状态。
      // 只有当是全新创建时，才会使用 req.body.status 或默认值 'Stocked'
    };

    const savedAsset = await Asset.findOneAndUpdate(
      { order: orderId }, 
      updateData, 
      { 
        new: true,        // 返回更新后的文档
        upsert: true,     // 🔥 核心开关：不存在则创建
        setDefaultsOnInsert: true // 插入时应用 schema 默认值 (如 status: 'Stocked')
      }
    );

    // 判断是新建还是更新
    const isNew = savedAsset.createdAt === savedAsset.updatedAt; // 简单判断，或者根据 upsertedCount

    res.status(200).json({ 
      success: true, 
      data: savedAsset, 
      message: isNew ? '存档成功' : '数据已更新' 
    });

  } catch (error) {
    console.error('[Asset] 存档失败:', error);
    // 处理可能的唯一索引冲突（虽然 upsert 已经处理了，但防御性编程）
    if (error.code === 11000) {
       return res.status(200).json({ success: true, message: '数据重复，已跳过' });
    }
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 3. 获取资产列表 ====================
router.get('/', auth, async (req, res) => {
  try {
    const assets = await Asset.find()
      .populate('order', 'orderNumber status jobSnapshot') // 关联订单基本信息
      .populate('user', 'email username') // 关联用户
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('[Asset] 查询失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 4. 更新资产 ====================
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 🛡️ 安全配置：禁止通过普通更新修改 order ID
    delete updates.order; 

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
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await Asset.findByIdAndDelete(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

export default router;

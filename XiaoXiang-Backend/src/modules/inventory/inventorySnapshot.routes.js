// src/modules/inventory/inventorySnapshot.routes.js
import express from 'express';
import InventorySnapshot from './inventorySnapshot.model.js';
import { authenticate } from '../../common/middlewares/auth.js';

const router = express.Router();

// ==================== 辅助函数 ====================

/**
 * 清理旧版本，只保留最新 + 最多3个历史版本
 */
const cleanupOldVersions = async () => {
  // 获取所有版本，按创建时间倒序
  const allVersions = await InventorySnapshot.find()
    .sort({ createdAt: -1 })
    .select('_id');
  
  // 保留最新4个版本（1个最新 + 3个历史）
  const keepCount = 4;
  
  if (allVersions.length > keepCount) {
    const idsToDelete = allVersions.slice(keepCount).map(v => v._id);
    await InventorySnapshot.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`[InventorySnapshot] 已清理 ${idsToDelete.length} 个旧版本`);
  }
};

// ==================== 1. 保存快照 ====================
router.post('/snapshot', authenticate, async (req, res) => {
  try {
    const { data, remark } = req.body;
    
    if (!data) {
      return res.status(400).json({ 
        success: false, 
        message: '快照数据不能为空' 
      });
    }

    // 获取当前最新版本号
    const latestVersion = await InventorySnapshot.findOne()
      .sort({ version: -1 })
      .select('version');
    
    const newVersion = (latestVersion?.version || 0) + 1;

    // 将之前的最新版本标记为非最新
    await InventorySnapshot.updateMany(
      { isLatest: true },
      { isLatest: false }
    );

    // 创建新快照
    const newSnapshot = await InventorySnapshot.create({
      data: {
        skuList: data.skuList || [],
        categories: data.categories || [],
        bindOrders: data.bindOrders || [],
        stats: data.stats || { totalSku: 0, totalStock: 0, totalBindOrders: 0 }
      },
      remark: remark || '',
      version: newVersion,
      isLatest: true
    });

    // 清理旧版本
    await cleanupOldVersions();

    res.status(200).json({ 
      success: true, 
      data: {
        id: newSnapshot._id,
        version: newVersion,
        remark: newSnapshot.remark,
        createdAt: newSnapshot.createdAt
      },
      message: '库存快照保存成功' 
    });

  } catch (error) {
    console.error('[InventorySnapshot] 保存失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '保存失败: ' + error.message 
    });
  }
});

// ==================== 2. 获取最新快照 ====================
router.get('/snapshot', authenticate, async (req, res) => {
  try {
    const latest = await InventorySnapshot.findOne({ isLatest: true })
      .sort({ createdAt: -1 });
    
    if (!latest) {
      return res.json({ 
        success: true, 
        data: null,
        message: '暂无库存快照数据' 
      });
    }

    res.json({ 
      success: true, 
      data: {
        id: latest._id,
        data: latest.data,
        remark: latest.remark,
        version: latest.version,
        createdAt: latest.createdAt
      }
    });

  } catch (error) {
    console.error('[InventorySnapshot] 获取失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// ==================== 3. 获取历史版本列表 ====================
router.get('/history', authenticate, async (req, res) => {
  try {
    const history = await InventorySnapshot.find()
      .sort({ createdAt: -1 })
      .limit(4)
      .select('remark version isLatest createdAt');
    
    res.json({ 
      success: true, 
      data: history.map(item => ({
        id: item._id,
        remark: item.remark,
        version: item.version,
        isLatest: item.isLatest,
        createdAt: item.createdAt
      }))
    });

  } catch (error) {
    console.error('[InventorySnapshot] 获取历史失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取历史失败' 
    });
  }
});

// ==================== 4. 恢复指定版本 ====================
router.post('/restore/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const targetSnapshot = await InventorySnapshot.findById(id);
    
    if (!targetSnapshot) {
      return res.status(404).json({ 
        success: false, 
        message: '版本不存在' 
      });
    }

    // 将所有版本标记为非最新
    await InventorySnapshot.updateMany(
      { isLatest: true },
      { isLatest: false }
    );

    // 将目标版本标记为最新
    targetSnapshot.isLatest = true;
    await targetSnapshot.save();

    res.json({ 
      success: true, 
      data: {
        id: targetSnapshot._id,
        data: targetSnapshot.data,
        remark: targetSnapshot.remark,
        version: targetSnapshot.version,
        createdAt: targetSnapshot.createdAt
      },
      message: '已恢复到指定版本' 
    });

  } catch (error) {
    console.error('[InventorySnapshot] 恢复失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '恢复失败' 
    });
  }
});

// ==================== 5. 删除指定版本 ====================
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const snapshot = await InventorySnapshot.findById(id);
    
    if (!snapshot) {
      return res.status(404).json({ 
        success: false, 
        message: '版本不存在' 
      });
    }

    // 不允许删除当前最新版本
    if (snapshot.isLatest) {
      return res.status(400).json({ 
        success: false, 
        message: '不能删除当前正在使用的版本' 
      });
    }

    await InventorySnapshot.findByIdAndDelete(id);

    res.json({ 
      success: true, 
      message: '版本已删除' 
    });

  } catch (error) {
    console.error('[InventorySnapshot] 删除失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除失败' 
    });
  }
});

export default router;

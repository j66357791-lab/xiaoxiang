// src/modules/logs/operationLog.controller.js
import OperationLog from './operationLog.model.js';

/**
 * 记录操作日志 (内部方法)
 */
export const logOperation = async (params) => {
  try {
    const log = await OperationLog.create({
      operator: null,
      operatorEmail: params.operatorEmail || '系统操作',
      action: params.action,
      targetType: params.targetType || 'Asset',
      targetId: params.targetId || null,
      targetNumber: params.targetNumber || '-',
      details: params.details || '',
      metadata: params.metadata || {},
    });
    return log;
  } catch (error) {
    console.error('[OperationLog] 记录日志失败:', error);
    return null;
  }
};

/**
 * 获取日志列表
 */
export const getLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 50, 
      action, 
      startDate, 
      endDate, 
      keyword 
    } = req.query;

    const filter = {};
    
    if (action && action !== 'all') {
      filter.action = action;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    
    if (keyword) {
      filter.$or = [
        { targetNumber: { $regex: keyword, $options: 'i' } },
        { details: { $regex: keyword, $options: 'i' } },
        { operatorEmail: { $regex: keyword, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const logs = await OperationLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    const total = await OperationLog.countDocuments(filter);

    const formattedLogs = logs.map(log => ({
      id: log._id,
      time: log.createdAt.toISOString().replace('T', ' ').substring(0, 19),
      operator: log.operatorEmail,
      action: log.action,
      orderId: log.targetNumber || '-',
      details: log.details,
      targetType: log.targetType
    }));

    res.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('[OperationLog] 获取日志失败:', error);
    res.status(500).json({ success: false, message: '获取日志失败' });
  }
};

/**
 * 创建日志记录 (API接口)
 * 🔥 前端直接传递所有数据，后端只负责接收保存
 */
export const createLog = async (req, res) => {
  try {
    // 🔥 直接从前端请求体获取所有数据
    const { action, targetNumber, details, operatorEmail } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: '缺少操作类型' });
    }

    const log = await OperationLog.create({
      operator: null,
      operatorEmail: operatorEmail || '系统操作',
      action,
      targetNumber: targetNumber || '-',
      details: details || '',
    });

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('[OperationLog] 创建日志失败:', error);
    res.status(500).json({ success: false, message: '创建日志失败' });
  }
};

/**
 * 获取日志统计
 */
export const getLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = end;
      }
    }

    const stats = await OperationLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats.map(s => ({ action: s._id, count: s.count }))
    });
  } catch (error) {
    console.error('[OperationLog] 获取统计失败:', error);
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
};

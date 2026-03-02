// src/modules/logs/operationLog.controller.js
import OperationLog from './operationLog.model.js';

/**
 * 记录操作日志 (内部方法)
 * @param {Object} params - 日志参数
 * @param {String} params.action - 操作类型
 * @param {String} params.operatorId - 操作人ID
 * @param {String} params.operatorEmail - 操作人邮箱
 * @param {String} params.targetType - 目标类型
 * @param {String} params.targetId - 目标ID
 * @param {String} params.targetNumber - 目标编号
 * @param {String} params.details - 操作详情
 * @param {Object} params.metadata - 元数据
 */
export const logOperation = async (params) => {
  try {
    const log = await OperationLog.create({
      operator: params.operatorId,
      operatorEmail: params.operatorEmail,
      action: params.action,
      targetType: params.targetType || 'Asset',
      targetId: params.targetId,
      targetNumber: params.targetNumber,
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
 * GET /api/logs
 * 查询参数:
 * - page: 页码 (默认1)
 * - pageSize: 每页数量 (默认50)
 * - action: 操作类型筛选
 * - startDate: 开始日期
 * - endDate: 结束日期
 * - keyword: 关键词搜索
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

    // 构建查询条件
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

    // 分页查询
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const logs = await OperationLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    const total = await OperationLog.countDocuments(filter);

    // 格式化返回数据
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
 * POST /api/logs
 */
export const createLog = async (req, res) => {
  try {
    const { action, targetId, targetNumber, details, metadata } = req.body;
    
    // 从请求中获取用户信息
    const operatorId = req.user?._id || req.user?.id;
    const operatorEmail = req.user?.email || '未知用户';

    if (!action) {
      return res.status(400).json({ success: false, message: '缺少操作类型' });
    }

    const log = await logOperation({
      action,
      operatorId,
      operatorEmail,
      targetId,
      targetNumber,
      details,
      metadata
    });

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('[OperationLog] 创建日志失败:', error);
    res.status(500).json({ success: false, message: '创建日志失败' });
  }
};

/**
 * 获取日志统计
 * GET /api/logs/stats
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

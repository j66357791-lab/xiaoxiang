import express from 'express';
import { auth } from '../../../common/middlewares/auth.js';
import StockLog from '../models/stockLog.model.js';
import asyncHandler from '../../../common/utils/asyncHandler.js';
import { success } from '../../../common/utils/response.js';

const router = express.Router();

// 获取操作日志列表
router.get('/', auth, asyncHandler(async (req, res) => {
  const { module, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  let query = {};
  if (module) query.module = module;
  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  
  const logs = await StockLog.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));
      
  const total = await StockLog.countDocuments(query);
  
  return success(res, { logs, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
}));

export default router;

import express from 'express';
import { protect } from '../../../common/middlewares/auth.js';
import StockLog from '../models/stockLog.model.js';
// ✅ 修正：使用解构导入
import { asyncHandler } from '../../../common/utils/asyncHandler.js';
import { success } from '../../../common/utils/response.js';

const router = express.Router();

router.get('/', protect, asyncHandler(async (req, res) => {
  const { module, page = 1, limit = 20 } = req.query;
  let query = {};
  if (module) query.module = module;
  
  const logs = await StockLog.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));
      
  const total = await StockLog.countDocuments(query);
  return success(res, '获取成功', { logs, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
}));

export default router;

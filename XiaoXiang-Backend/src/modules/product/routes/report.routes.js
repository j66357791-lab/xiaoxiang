import express from 'express';
import { authenticate, authorize } from '../../../common/middlewares/auth.js';
import * as ctrl from '../controllers/report.controller.js';
import * as profitCtrl from '../services/profit.service.js';
const router = express.Router();

// 生成日报表
router.post('/generate', authenticate, authorize('admin'), ctrl.generateReport);

// 获取报表列表
router.get('/list', authenticate, ctrl.getReports);

// 导出报表
router.get('/export/:id', authenticate, authorize('admin'), ctrl.exportReport);

// ==================== 收益中心 API ====================

// 收益概览
router.get('/overview', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { range = 'today' } = req.query;
    const data = await profitCtrl.getOverview(range);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Report] 获取收益概览失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 结算预警
router.get('/warnings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const data = await profitCtrl.getSettleWarnings();
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Report] 获取结算预警失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 资金预测
router.get('/forecast', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const data = await profitCtrl.getFundForecast(parseInt(days));
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Report] 获取资金预测失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

import * as reportService from '../services/report.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

// 收益概览
export const getOverview = asyncHandler(async (req, res) => {
  const { range = 'today' } = req.query;
  const data = await reportService.getOverview(range);
  return success(res, '获取成功', data);
});

// 结算预警
export const getWarnings = asyncHandler(async (req, res) => {
  const data = await reportService.getSettleWarnings();
  return success(res, '获取成功', data);
});

// 资金预测
export const getForecast = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const data = await reportService.getFundForecast(parseInt(days));
  return success(res, '获取成功', data);
});

// 库存统计
export const getStockStats = asyncHandler(async (req, res) => {
  const data = await reportService.getStockStats();
  return success(res, '获取成功', data);
});

import * as reportService from '../services/report.service.js';
import { success } from '../../../common/utils/response.js';
import asyncHandler from '../../../common/utils/asyncHandler.js';

export const generateReport = asyncHandler(async (req, res) => {
  const report = await reportService.generateDailyReport(req.user);
  return success(res, '报表生成成功', report, 201);
});

export const getReports = asyncHandler(async (req, res) => {
  const reports = await reportService.getReports();
  return success(res, '获取成功', reports);
});

import * as service from '../services/report.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const generateReport = asyncHandler(async (req, res) => {
  const data = await service.generateDailyReport(req.user);
  return success(res, '生成成功', data, 201);
});
export const getReports = asyncHandler(async (req, res) => {
  const data = await service.getReports();
  return success(res, '获取成功', data);
});
export const exportReport = asyncHandler(async (req, res) => {
  const data = await service.exportReport(req.params.id);
  return success(res, '导出数据准备完成', data);
});

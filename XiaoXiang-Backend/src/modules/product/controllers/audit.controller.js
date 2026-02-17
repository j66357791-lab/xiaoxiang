import * as auditService from '../services/audit.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

// 获取今日审计
export const getTodayAudit = asyncHandler(async (req, res) => {
  const data = await auditService.getTodayAudit();
  return success(res, '获取成功', data);
});

// 获取审计历史
export const getAuditHistory = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const data = await auditService.getAuditHistory(parseInt(days));
  return success(res, '获取成功', data);
});

// 执行夜审
export const executeAudit = asyncHandler(async (req, res) => {
  const data = await auditService.executeAudit(req.user);
  return success(res, '夜审执行成功', data);
});

// 获取审计详情
export const getAuditById = asyncHandler(async (req, res) => {
  const data = await auditService.getAuditById(req.params.id);
  return success(res, '获取成功', data);
});

// 获取审计统计
export const getAuditStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await auditService.getAuditStats(startDate, endDate);
  return success(res, '获取成功', data);
});

export default {
  getTodayAudit,
  getAuditHistory,
  executeAudit,
  getAuditById,
  getAuditStats
};

import * as service from '../services/recycle.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const publishTask = asyncHandler(async (req, res) => {
  const data = await service.publishTask(req.body, req.user);
  return success(res, '发布成功', data, 201);
});
export const takeOrder = asyncHandler(async (req, res) => {
  const data = await service.takeOrder(req.params.taskId, req.user._id);
  return success(res, '接单成功', data, 201);
});
export const getOrders = asyncHandler(async (req, res) => {
  const data = await service.getOrders(req.query);
  return success(res, '获取成功', data);
});
export const updateStatus = asyncHandler(async (req, res) => {
  const data = await service.updateStatus(req.params.id, req.body.status, req.body.reason, req.user);
  return success(res, '更新成功', data);
});
export const bindSaleInfo = asyncHandler(async (req, res) => {
  const data = await service.bindSaleInfo(req.params.id, req.body, req.user);
  return success(res, '绑定成功', data);
});
export const getOpenTasks = asyncHandler(async (req, res) => {
  const data = await service.getOpenTasks(req.query.category, req.query.sort);
  return success(res, '获取成功', data);
});
export const exportOrders = asyncHandler(async (req, res) => {
  const data = await service.exportOrders(req.query);
  return success(res, '导出数据准备完成', data);
});

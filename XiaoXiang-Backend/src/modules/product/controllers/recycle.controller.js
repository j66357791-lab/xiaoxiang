import * as recycleService from '../services/recycle.service.js';
import { success } from '../../../common/utils/response.js';
import asyncHandler from '../../../common/utils/asyncHandler.js';

export const publishTask = asyncHandler(async (req, res) => {
  const task = await recycleService.publishTask(req.body, req.user);
  return success(res, '发布成功', task, 201);
});

export const takeOrder = asyncHandler(async (req, res) => {
  const order = await recycleService.takeOrder(req.params.taskId, req.user._id);
  return success(res, '接单成功', order, 201);
});

export const getOrders = asyncHandler(async (req, res) => {
  const orders = await recycleService.getOrders(req.query);
  return success(res, '获取成功', orders);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const order = await recycleService.updateStatus(req.params.id, status, reason, req.user);
  return success(res, '状态更新成功', order);
});

export const bindSaleInfo = asyncHandler(async (req, res) => {
  const order = await recycleService.bindSaleInfo(req.params.id, req.body, req.user);
  return success(res, '绑定成功', order);
});

// 公开接口
export const getOpenTasks = asyncHandler(async (req, res) => {
  const { category, sort } = req.query;
  const tasks = await recycleService.getOpenTasks(category, sort);
  return success(res, '获取成功', tasks);
});

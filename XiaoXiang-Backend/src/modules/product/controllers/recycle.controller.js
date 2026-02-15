import * as recycleService from '../services/recycle.service.js';
import { success } from '../../../common/utils/response.js';
import asyncHandler from '../../../common/utils/asyncHandler.js';

export const publishTask = asyncHandler(async (req, res) => {
  const task = await recycleService.publishTask(req.body, req.user);
  return success(res, task, '发布成功', 201);
});

export const takeOrder = asyncHandler(async (req, res) => {
  // 模拟用户接单，实际应从 req.user 获取用户ID
  const order = await recycleService.takeOrder(req.params.taskId, req.user._id);
  return success(res, order, '接单成功', 201);
});

export const getOrders = asyncHandler(async (req, res) => {
  const orders = await recycleService.getOrders(req.query);
  return success(res, orders);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const order = await recycleService.updateStatus(req.params.id, status, reason, req.user);
  return success(res, order);
});

export const bindSaleInfo = asyncHandler(async (req, res) => {
  const order = await recycleService.bindSaleInfo(req.params.id, req.body, req.user);
  return success(res, order);
});

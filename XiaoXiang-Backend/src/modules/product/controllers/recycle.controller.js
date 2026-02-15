import * as recycleService from '../services/recycle.service.js';
import { success } from '../../../common/utils/response.js';
// ✅ 修正：使用花括号进行命名导入
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

export const publishTask = asyncHandler(async (req, res) => {
  const task = await recycleService.publishTask(req.body, req.user);
  return success(res, task, '发布成功', 201);
});

export const takeOrder = asyncHandler(async (req, res) => {
  // 注意：这里模拟用户接单，实际应从 req.user 获取
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

// 新增：公开接口
export const getOpenTasks = asyncHandler(async (req, res) => {
  const { category, sort } = req.query;
  const tasks = await recycleService.getOpenTasks(category, sort);
  return success(res, tasks);
});

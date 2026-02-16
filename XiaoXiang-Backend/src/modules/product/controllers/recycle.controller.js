import * as service from '../services/recycle.service.js';
import { success } from '../../../common/utils/response.js';
import { asyncHandler } from '../../../common/utils/asyncHandler.js';

// ==================== 任务相关 ====================

// 发布回收任务
export const publishTask = asyncHandler(async (req, res) => {
  const data = await service.publishTask(req.body, req.user);
  return success(res, '发布成功', data, 201);
});

// 获取任务列表
export const getTasks = asyncHandler(async (req, res) => {
  const data = await service.getTasks(req.query);
  return success(res, '获取成功', data);
});

// 获取开放任务（用户端）
export const getOpenTasks = asyncHandler(async (req, res) => {
  const data = await service.getOpenTasks(req.query);
  return success(res, '获取成功', data);
});

// 用户接单
export const takeOrder = asyncHandler(async (req, res) => {
  const data = await service.takeOrder(req.params.taskId, req.user._id);
  return success(res, '接单成功', data, 201);
});

// ==================== 订单相关 ====================

// 获取订单列表
export const getOrders = asyncHandler(async (req, res) => {
  const data = await service.getOrders(req.query);
  return success(res, '获取成功', data);
});

// 更新订单状态
export const updateStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const data = await service.updateStatus(req.params.id, status, reason, req.user);
  return success(res, '更新成功', data);
});

// 绑定售卖信息
export const bindSaleInfo = asyncHandler(async (req, res) => {
  const data = await service.bindSaleInfo(req.params.id, req.body, req.user);
  return success(res, '绑定成功', data);
});

// 审核订单
export const reviewOrder = asyncHandler(async (req, res) => {
  const { approved, remark } = req.body;
  const data = await service.reviewOrder(req.params.id, approved, remark, req.user);
  return success(res, '审核成功', data);
});

// 更新备注
export const updateRemark = asyncHandler(async (req, res) => {
  const { remark } = req.body;
  const data = await service.updateRemark(req.params.id, remark, req.user);
  return success(res, '更新成功', data);
});

// 确认收货
export const confirmReceive = asyncHandler(async (req, res) => {
  const data = await service.confirmReceive(req.params.id, req.user);
  return success(res, '确认成功', data);
});

// 确认结算
export const confirmSettle = asyncHandler(async (req, res) => {
  const data = await service.confirmSettle(req.params.id, req.user);
  return success(res, '结算成功', data);
});

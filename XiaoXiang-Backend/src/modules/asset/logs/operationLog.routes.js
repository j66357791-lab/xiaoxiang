// src/modules/logs/operationLog.routes.js
import express from 'express';
import { getLogs, createLog, getLogStats } from './operationLog.controller.js';

const router = express.Router();

// 获取日志列表
router.get('/', getLogs);

// 创建日志记录
router.post('/', createLog);

// 获取日志统计
router.get('/stats', getLogStats);

export default router;

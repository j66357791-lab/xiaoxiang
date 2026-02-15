import express from 'express';
import { AuditController } from './audit.controller.js';
import { authenticate, authorize } from '../../common/middlewares/auth.js';

const router = express.Router();

// 用户路由（需要登录）
router.use(authenticate);

// 申请升级
router.post('/apply', AuditController.applyUpgrade);

// 自动升级（1-3级）
router.post('/auto-upgrade', AuditController.autoUpgrade);

// 获取我的审核状态
router.get('/my-status', AuditController.getMyAuditStatus);

// 管理员路由
router.get('/pending', authorize('admin', 'superAdmin'), AuditController.getPendingAudits);
router.post('/:id/review', authorize('admin', 'superAdmin'), AuditController.reviewAudit);

export default router;

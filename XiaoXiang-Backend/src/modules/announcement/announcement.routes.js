import express from 'express';
import { 
  getActiveAnnouncements, 
  getAllAnnouncements, 
  getAnnouncement,
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement 
} from './announcement.controller.js';
import { protect, authorize } from '../auth/auth.middleware.js';

const router = express.Router();

// ========== 公开路由 ==========

// 获取活跃公告（用户端）
router.get('/active', getActiveAnnouncements);

// 兼容路径
router.get('/', getActiveAnnouncements);

// ========== 管理员路由 ==========

// 获取所有公告
router.get('/admin/all', protect, authorize('admin', 'superAdmin'), getAllAnnouncements);

// 获取单个公告
router.get('/admin/:id', protect, authorize('admin', 'superAdmin'), getAnnouncement);

// 创建公告
router.post('/admin', protect, authorize('admin', 'superAdmin'), createAnnouncement);

// 更新公告
router.put('/admin/:id', protect, authorize('admin', 'superAdmin'), updateAnnouncement);

// 删除公告
router.delete('/admin/:id', protect, authorize('admin', 'superAdmin'), deleteAnnouncement);

export default router;

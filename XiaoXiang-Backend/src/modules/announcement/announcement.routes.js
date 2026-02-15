import express from 'express';
import { 
  getActiveAnnouncements, 
  getAllAnnouncements, 
  getAnnouncement,
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement 
} from './announcement.controller.js';
import { authenticate, authorize } from '../../common/middlewares/auth.js';

const router = express.Router();

// ========== 公开路由 ==========

// 获取活跃公告（用户端）
router.get('/active', getActiveAnnouncements);

// 兼容路径
router.get('/', getActiveAnnouncements);

// ========== 管理员路由 ==========

// 获取所有公告
router.get('/admin/all', authenticate, authorize('admin', 'superAdmin'), getAllAnnouncements);

// 获取单个公告
router.get('/admin/:id', authenticate, authorize('admin', 'superAdmin'), getAnnouncement);

// 创建公告
router.post('/admin', authenticate, authorize('admin', 'superAdmin'), createAnnouncement);

// 更新公告
router.put('/admin/:id', authenticate, authorize('admin', 'superAdmin'), updateAnnouncement);

// 删除公告
router.delete('/admin/:id', authenticate, authorize('admin', 'superAdmin'), deleteAnnouncement);

export default router;

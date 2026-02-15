import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth.js';
import { AuthController } from './auth.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadFields } from '../../common/middlewares/upload.js';
import { simpleAuthValidator } from './auth.validator.js';

const router = Router();

// =====================
// 公开接口
// =====================

// 注册
router.post('/register',
  simpleAuthValidator,
  asyncHandler(AuthController.register)
);

// 登录
router.post('/login',
  simpleAuthValidator,
  asyncHandler(AuthController.login)
);

// =====================
// 认证接口
// =====================

// 获取当前登录用户信息
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    return res.json({
      success: true,
      data: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        balance: req.user.balance,
        points: req.user.points,
        name: req.user.name || '小象用户',
        avatarColor: req.user.avatarColor || 'blue',
        kycStatus: req.user.kycStatus || 'Unverified',
        createdAt: req.user.createdAt
      }
    });
  })
);

// 提交实名认证
router.post('/kyc',
  authenticate,
  uploadFields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 }
  ]),
  asyncHandler(AuthController.submitKYC)
);

export default router;

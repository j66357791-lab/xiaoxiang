import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth.js';
import { validate } from '../../common/middlewares/validator.js';
import { AuthController } from './auth.controller.js';
import { authValidators } from './auth.validator.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadFields } from '../../common/middlewares/upload.js';

const router = Router();

// 公开接口

// 注册
router.post('/register',
  validate(authValidators.register),
  asyncHandler(AuthController.register)
);

// 登录
router.post('/login',
  validate(authValidators.login),
  asyncHandler(AuthController.login)
);

// 认证接口

// 提交实名认证
router.post('/kyc',
  authenticate,
  uploadFields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 }
  ]),
  asyncHandler(async (req, res, next) => {
    const { userId, idCard } = req.body;
    const files = req.files;

    if (!files || !files.front || !files.back) {
      return res.status(400).json({
        success: false,
        message: '请上传身份证正反面'
      });
    }

    const idCardFront = `/uploads/${files.front[0].filename}`;
    const idCardBack = `/uploads/${files.back[0].filename}`;

    const user = await AuthService.submitKYC(userId, idCard, idCardFront, idCardBack);

    return res.json({
      success: true,
      message: '提交成功，等待审核',
      data: user
    });
  })
);

export default router;

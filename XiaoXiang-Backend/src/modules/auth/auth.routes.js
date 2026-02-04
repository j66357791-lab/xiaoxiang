import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth.js';
// 👈 这里移除了 validate 和 authValidators，改为引入简化校验
import { AuthController } from './auth.controller.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { uploadFields } from '../../common/middlewares/upload.js';
import { simpleAuthValidator } from './auth.validator.js'; // 👈 确保这里引入的是上面的函数

const router = Router();

// 公开接口

// 注册
router.post('/register',
  simpleAuthValidator, // 👈 使用简化校验
  asyncHandler(AuthController.register)
);

// 登录
router.post('/login',
  simpleAuthValidator, // 👈 使用简化校验
  asyncHandler(AuthController.login)
);

// 认证接口

// 提交实名认证
router.post('/kyc',
  uploadFields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 }
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      // 优先使用 Token 中的 userId
      let userId = req.user?._id;
      
      // 如果没有 Token，使用 Body 中的 userId (兼容旧写法)
      if (!userId) {
        userId = req.body.userId;
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: '无法识别用户身份'
        });
      }

      const { idCard } = req.body;
      const files = req.files;

      if (!files || !files.front || !files.back) {
        return res.status(400).json({
          success: false,
          message: '请上传身份证正反面'
        });
      }

      const idCardFront = `/uploads/${files.front[0].filename}`;
      const idCardBack = `/uploads/${files.back[0].filename}`;

      // 调用 AuthController 提交 KYC
      const user = await AuthController.submitKYC(userId, idCard, idCardFront, idCardBack);

      return res.status(200).json({
        success: true,
        message: '提交成功，等待审核',
        data: user
      });
    } catch (error) {
      console.error('[KYC Error]', error);
      return res.status(500).json({
        success: false,
        message: error.message || '服务器错误'
      });
    }
  })
);

export default router;

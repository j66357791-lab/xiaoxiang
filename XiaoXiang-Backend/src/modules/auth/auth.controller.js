import { success } from '../../common/utils/response.js';
import { AuthService } from './auth.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

/**
 * 认证控制器
 */
export class AuthController {
  /**
   * 注册
   */
  static register = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, token } = await AuthService.register(email, password);

    return success(res, {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        balance: user.balance,
        points: user.points
      },
      token
    }, '注册成功', 201);
  });

  /**
   * 登录
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, token } = await AuthService.login(email, password);

    return success(res, {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        balance: user.balance,
        points: user.points,
        lastLogin: user.lastLogin
      },
      token
    }, '登录成功');
  });

  /**
   * 提交实名认证
   */
  static submitKYC = asyncHandler(async (req, res) => {
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

    const { name, idCard } = req.body;
    const files = req.files;

    // 验证必填参数
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: '请输入真实姓名'
      });
    }

    if (!idCard || idCard.length !== 18) {
      return res.status(400).json({
        success: false,
        message: '请输入正确的18位身份证号码'
      });
    }

    if (!files || !files.front || !files.back) {
      return res.status(400).json({
        success: false,
        message: '请上传身份证正反面'
      });
    }

    const idCardFront = `/uploads/${files.front[0].filename}`;
    const idCardBack = `/uploads/${files.back[0].filename}`;

    const user = await AuthService.submitKYC(userId, name.trim(), idCard, idCardFront, idCardBack);

    return success(res, {
      id: user._id,
      kycStatus: user.kycStatus,
      realName: user.realName
    }, '提交成功，等待审核');
  });

  /**
   * 撤回实名认证申请
   */
  static withdrawKYC = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '无法识别用户身份'
      });
    }

    const user = await AuthService.withdrawKYC(userId);

    return success(res, {
      id: user._id,
      kycStatus: user.kycStatus
    }, '已撤回实名认证申请');
  });
}

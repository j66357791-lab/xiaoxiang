import { UserService } from '../users/user.service.js';
import { generateToken } from '../../common/middlewares/auth.js';
import { BadRequestError, ConflictError } from '../../common/utils/error.js';

// 聚合数据实名认证API配置
const JUHE_API_KEY = process.env.JUHE_API_KEY || '449c2e8ed6dd42a16fc4822bae04d612';
const JUHE_API_URL = 'http://op.juhe.cn/idcard/query';

/**
 * 认证服务层
 */
export class AuthService {
  /**
   * 用户注册
   */
  static async register(email, password) {
    // 检查邮箱是否已注册
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('该邮箱已被注册');
    }

    // 创建用户
    const user = await UserService.register(email, password);

    // 生成 Token
    const token = generateToken(user._id);

    return { user, token };
  }

  /**
   * 用户登录
   */
  static async login(email, password) {
    // 验证用户
    const user = await UserService.login(email, password);

    // 生成 Token
    const token = generateToken(user._id);

    return { user, token };
  }

  /**
   * 调用聚合数据API验证姓名和身份证号
   * @param {string} realName - 真实姓名
   * @param {string} idCard - 身份证号
   * @returns {Promise<{verified: boolean, reason?: string}>}
   */
  static async verifyIdCardWithJuhe(realName, idCard) {
    try {
      const url = `${JUHE_API_URL}?key=${JUHE_API_KEY}&idcard=${idCard}&realname=${encodeURIComponent(realName)}&orderid=1`;
      
      console.log(`[KYC] 调用聚合API验证: ${realName}, ${idCard.substring(0, 6)}****`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[KYC] 聚合API返回:', JSON.stringify(data));
      
      // error_code 为 0 且 res 为 1 表示验证通过
      if (data.error_code === 0 && data.result && data.result.res === 1) {
        return { verified: true };
      }
      
      // 验证失败
      if (data.error_code === 0 && data.result && data.result.res === 2) {
        return { 
          verified: false, 
          reason: '姓名与身份证号不匹配，请核对后重新提交' 
        };
      }
      
      // 其他错误
      return { 
        verified: false, 
        reason: data.reason || '实名验证失败，请稍后重试' 
      };
    } catch (error) {
      console.error('[KYC] 聚合API调用失败:', error.message);
      // API调用失败时，允许提交但标记为待人工审核
      return { 
        verified: false, 
        reason: '验证服务暂时不可用，您的申请将进入人工审核流程',
        fallback: true  // 标记为降级处理
      };
    }
  }

  /**
   * 提交实名认证
   * @param {string} userId - 用户ID
   * @param {string} realName - 真实姓名
   * @param {string} idCard - 身份证号
   * @param {string} idCardFront - 身份证正面照片路径
   * @param {string} idCardBack - 身份证背面照片路径
   */
  static async submitKYC(userId, realName, idCard, idCardFront, idCardBack) {
    // 调用聚合数据API验证姓名和身份证号
    const verifyResult = await this.verifyIdCardWithJuhe(realName, idCard);
    
    // 验证失败且非降级处理
    if (!verifyResult.verified && !verifyResult.fallback) {
      throw new BadRequestError(verifyResult.reason);
    }
    
    // 验证成功或降级处理，保存到数据库
    const user = await UserService.submitKYC(userId, realName, idCard, idCardFront, idCardBack);
    
    // 如果是降级处理，记录日志
    if (verifyResult.fallback) {
      console.log(`[KYC] 用户 ${userId} 进入人工审核流程: ${verifyResult.reason}`);
    }
    
    return user;
  }
}

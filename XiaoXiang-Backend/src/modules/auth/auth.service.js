import { UserService } from '../users/user.service/index.js';
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
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('该邮箱已被注册');
    }

    const user = await UserService.register(email, password);
    const token = generateToken(user._id);

    return { user, token };
  }

  /**
   * 用户登录
   */
  static async login(email, password) {
    const user = await UserService.login(email, password);
    const token = generateToken(user._id);
    return { user, token };
  }

  /**
   * 调用聚合数据API验证姓名和身份证号
   */
  static async verifyIdCardWithJuhe(realName, idCard) {
    try {
      const url = `${JUHE_API_URL}?key=${JUHE_API_KEY}&idcard=${idCard}&realname=${encodeURIComponent(realName)}&orderid=1`;
      
      console.log(`[KYC] 调用聚合API验证: ${realName}, ${idCard.substring(0, 6)}****`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[KYC] 聚合API返回:', JSON.stringify(data));
      
      // error_code 不为 0，表示API调用失败
      if (data.error_code !== 0) {
        console.log(`[KYC] API错误: error_code=${data.error_code}, reason=${data.reason}`);
        return { 
          verified: false, 
          reason: data.reason || '实名验证服务异常，请稍后重试',
          apiError: true
        };
      }
      
      // res 为 1 表示验证通过
      if (data.result && data.result.res === 1) {
        console.log(`[KYC] 验证通过: ${realName}`);
        return { 
          verified: true,
          orderid: data.result.orderid
        };
      }
      
      // res 为 2 表示不匹配
      if (data.result && data.result.res === 2) {
        console.log(`[KYC] 验证失败: 姓名与身份证号不匹配`);
        return { 
          verified: false, 
          reason: '姓名与身份证号不匹配，请核对后重新提交' 
        };
      }
      
      // 其他情况
      return { 
        verified: false, 
        reason: data.reason || '实名验证失败，请稍后重试' 
      };
    } catch (error) {
      console.error('[KYC] 聚合API调用失败:', error.message);
      return { 
        verified: false, 
        reason: '验证服务暂时不可用，请检查网络后重试',
        networkError: true
      };
    }
  }

  /**
   * 提交实名认证
   */
  static async submitKYC(userId, realName, idCard, idCardFront, idCardBack) {
    console.log(`[KYC] 开始提证实名认证: userId=${userId}, realName=${realName}`);
    
    // 调用聚合数据API验证姓名和身份证号
    const verifyResult = await this.verifyIdCardWithJuhe(realName, idCard);
    
    // 验证失败 - 直接抛出错误，不保存到数据库
    if (!verifyResult.verified) {
      console.log(`[KYC] 验证失败，不保存数据: ${verifyResult.reason}`);
      throw new BadRequestError(verifyResult.reason);
    }
    
    // 验证成功，保存到数据库
    console.log(`[KYC] 验证通过，开始保存到数据库...`);
    
    try {
      const user = await UserService.submitKYC(userId, realName, idCard, idCardFront, idCardBack);
      console.log(`[KYC] 保存成功! 用户 ${userId} 的实名认证已提交`);
      return user;
    } catch (saveError) {
      console.error(`[KYC] 保存失败!`, saveError);
      throw new BadRequestError('保存实名信息失败，请稍后重试');
    }
  }

  /**
   * 撤回实名认证申请
   */
  static async withdrawKYC(userId) {
    console.log(`[KYC] 用户 ${userId} 请求撤回实名认证`);
    
    const user = await UserService.findById(userId);
    
    // 只有待审核状态才能撤回
    if (user.kycStatus !== 'Pending') {
      console.log(`[KYC] 撤回失败: 当前状态为 ${user.kycStatus}`);
      throw new BadRequestError('当前状态无法撤回');
    }
    
    // 清空认证信息，恢复为未认证状态
    user.realName = null;
    user.idCard = null;
    user.idCardFront = null;
    user.idCardBack = null;
    user.kycStatus = 'Unverified';
    
    await user.save();
    
    console.log(`[KYC] 用户 ${userId} 已撤回实名认证申请`);
    
    return user;
  }
}


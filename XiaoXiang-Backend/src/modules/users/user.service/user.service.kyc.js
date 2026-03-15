/**
 * 用户服务 - KYC实名认证模块
 * 包含：实名认证提交、审核、撤回、重新核验等方法
 */
import User from '../user.model.js';
import { NotFoundError, BadRequestError } from '../../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';

// KYC 状态常量
const KYC_STATUS = {
  UNVERIFIED: 'Unverified',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected'
};

// 聚合数据API配置
const JUHE_API_KEY = process.env.JUHE_API_KEY || '449c2e8ed6dd42a16fc4822bae04d612';
const JUHE_API_URL = 'http://op.juhe.cn/idcard/query';

export class UserServiceKYC {
  /**
   * 提交实名认证
   */
  static async submitKYC(userId, realName, idCard, idCardFront, idCardBack, kycStatus = 'Pending', rejectReason = null) {
    console.log(`[UserService.submitKYC] 开始保存: userId=${userId}, realName=${realName}, status=${kycStatus}`);
    
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[UserService.submitKYC] 用户不存在: ${userId}`);
      throw new NotFoundError('用户不存在');
    }
    
    console.log(`[UserService.submitKYC] 找到用户: ${user.email}`);
    
    user.realName = realName;
    user.idCard = idCard;
    user.idCardFront = idCardFront;
    user.idCardBack = idCardBack;
    user.kycStatus = kycStatus;
    
    if (rejectReason) {
      user.abnormalReason = rejectReason;
    } else {
      user.abnormalReason = null;
    }
    
    console.log(`[UserService.submitKYC] 准备保存到数据库...`);
    
    const savedUser = await user.save();
    
    console.log(`[UserService.submitKYC] ✅ 保存成功! 用户 ${savedUser.email} 的 kycStatus=${savedUser.kycStatus}`);
    
    clearCache('/api/users/profile');
    
    return savedUser;
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
      
      if (data.error_code !== 0) {
        return { verified: false, reason: data.reason || '实名验证服务异常' };
      }
      
      if (data.result && data.result.res === 1) {
        return { verified: true };
      }
      
      if (data.result && data.result.res === 2) {
        return { verified: false, reason: '姓名与身份证号不匹配' };
      }
      
      return { verified: false, reason: data.reason || '实名验证失败' };
    } catch (error) {
      console.error('[KYC] 聚合API调用失败:', error.message);
      return { verified: false, reason: '验证服务暂时不可用' };
    }
  }

  /**
   * 🆕 重新核验（管理员调用）
   */
  static async reverifyKYC(userId) {
    console.log(`[UserService.reverifyKYC] 开始重新核验: userId=${userId}`);
    
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    
    if (!user.idCard || !user.realName) {
      throw new BadRequestError('用户缺少身份证信息，无法核验');
    }
    
    // 调用第三方API核验
    const verifyResult = await this.verifyIdCardWithJuhe(user.realName, user.idCard);
    
    if (verifyResult.verified) {
      user.abnormalReason = null;
      console.log(`[UserService.reverifyKYC] 核验通过: ${user.realName}`);
    } else {
      user.abnormalReason = verifyResult.reason;
      console.log(`[UserService.reverifyKYC] 核验失败: ${verifyResult.reason}`);
    }
    
    await user.save();
    clearCache('/api/users/profile');
    
    return {
      user,
      verified: verifyResult.verified,
      reason: verifyResult.reason
    };
  }

  /**
   * 撤回实名认证申请
   */
  static async withdrawKYC(userId) {
    console.log(`[UserService.withdrawKYC] 用户 ${userId} 请求撤回实名认证`);
    
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    if (user.kycStatus !== KYC_STATUS.PENDING) {
      throw new BadRequestError('当前状态无法撤回');
    }
    
    user.realName = null;
    user.idCard = null;
    user.idCardFront = null;
    user.idCardBack = null;
    user.kycStatus = KYC_STATUS.UNVERIFIED;
    user.abnormalReason = null;
    
    await user.save();
    clearCache('/api/users/profile');
    
    console.log(`[UserService.withdrawKYC] ✅ 用户 ${userId} 已撤回实名认证申请`);
    
    return user;
  }

  /**
   * 🆕 更新 KYC 审核状态（支持打回重审）
   */
  static async updateKYCStatus(userId, status) {
    const validStatuses = [KYC_STATUS.VERIFIED, KYC_STATUS.REJECTED, KYC_STATUS.PENDING];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的审核状态');
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    user.kycStatus = status;
    
    // 如果是打回重审，设置原因
    if (status === KYC_STATUS.PENDING) {
      user.abnormalReason = '管理员打回重审';
    }
    
    await user.save();
    clearCache('/api/users/profile');
    
    console.log(`[UserService.updateKYCStatus] 用户 ${userId} 状态更新为 ${status}`);
    return user;
  }

  /**
   * 自动审查KYC申请
   */
  static async autoCheckKYC(userIds) {
    let passed = 0;
    let abnormal = 0;
    let manual = 0;
    const abnormalUsers = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user || user.kycStatus !== 'Pending') continue;

        const idCard = user.idCard || '';
        let isAbnormal = false;
        let abnormalReason = '';

        const idCardValid = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard);
        if (!idCardValid) {
          isAbnormal = true;
          abnormalReason = '身份证号格式不正确';
        }

        if (!isAbnormal && idCard) {
          const duplicate = await User.findOne({
            _id: { $ne: userId },
            idCard: idCard,
            kycStatus: { $in: ['Pending', 'Verified'] }
          });
          if (duplicate) {
            isAbnormal = true;
            abnormalReason = '身份证号已被其他用户使用';
          }
        }

        if (isAbnormal) {
          user.kycStatus = 'Rejected';
          user.abnormalReason = abnormalReason;
          await user.save();
          abnormal++;
          abnormalUsers.push({ userId, reason: abnormalReason });
        } else {
          manual++;
        }
      } catch (e) {
        console.error(`[KYC AutoCheck] 用户 ${userId} 审查失败:`, e.message);
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC AutoCheck] 完成: 通过=${passed}, 异常=${abnormal}, 待人工=${manual}`);

    return { passed, abnormal, manual, abnormalUsers };
  }

  /**
   * 批量审批通过KYC
   */
  static async batchApproveKYC(userIds) {
    let passed = 0;
    const failed = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          failed.push({ userId, reason: '用户不存在' });
          continue;
        }
        if (user.kycStatus !== 'Pending') {
          failed.push({ userId, reason: '状态不是待审核' });
          continue;
        }

        user.kycStatus = KYC_STATUS.VERIFIED;
        await user.save();
        passed++;
      } catch (e) {
        failed.push({ userId, reason: e.message });
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC BatchApprove] 完成: 通过=${passed}, 失败=${failed.length}`);

    return { passed, failed };
  }

  /**
   * 批量拒绝KYC
   */
  static async batchRejectKYC(userIds) {
    let rejected = 0;
    const failed = [];

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          failed.push({ userId, reason: '用户不存在' });
          continue;
        }

        user.kycStatus = KYC_STATUS.REJECTED;
        await user.save();
        rejected++;
      } catch (e) {
        failed.push({ userId, reason: e.message });
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC BatchReject] 完成: 拒绝=${rejected}, 失败=${failed.length}`);

    return { rejected, failed };
  }

  /**
   * 深度核验已通过的KYC
   */
  static async deepVerifyKYC() {
    let normal = 0;
    let abnormal = 0;
    const abnormalUsers = [];

    const verifiedUsers = await User.find({ kycStatus: 'Verified' });

    for (const user of verifiedUsers) {
      let isAbnormal = false;
      let abnormalReason = '';

      if (!user.idCard) {
        isAbnormal = true;
        abnormalReason = '身份证号为空';
      }

      if (!isAbnormal && (!user.idCardFront || !user.idCardBack)) {
        isAbnormal = true;
        abnormalReason = '身份证照片缺失';
      }

      if (!isAbnormal && user.idCard) {
        const duplicate = await User.findOne({
          _id: { $ne: user._id },
          idCard: user.idCard,
          kycStatus: 'Verified'
        });
        if (duplicate) {
          isAbnormal = true;
          abnormalReason = '身份证号重复使用';
        }
      }

      if (isAbnormal) {
        user.abnormalReason = abnormalReason;
        await user.save();
        abnormal++;
        abnormalUsers.push({ userId: user._id, email: user.email, reason: abnormalReason });
      } else {
        normal++;
      }
    }

    clearCache('/api/users/profile');
    console.log(`[KYC DeepVerify] 完成: 正常=${normal}, 异常=${abnormal}`);

    return { normal, abnormal, abnormalUsers };
  }

  /**
   * 标记用户KYC为异常
   */
  static async markKYCAbnormal(userId, reason) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    user.kycStatus = 'Rejected';
    user.abnormalReason = reason;
    await user.save();
    
    clearCache('/api/users/profile');
    console.log(`[KYC] 用户 ${userId} 已标记为异常: ${reason}`);
    
    return user;
  }
}

/**
 * 用户服务 - KYC实名认证模块
 * 包含：实名认证提交、审核、撤回等方法
 */
import User from '../user.model.js';
import { NotFoundError, BadRequestError } from '../../common/utils/error.js';
import { clearCache } from '../../../common/middlewares/cache.js';

// KYC 状态常量
const KYC_STATUS = {
  UNVERIFIED: 'Unverified',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected'
};

export class UserServiceKYC {
  /**
   * 提交实名认证
   * ⚠️ 此方法由 AuthService.submitKYC 调用，已通过第三方核验
   */
  static async submitKYC(userId, realName, idCard, idCardFront, idCardBack) {
    console.log(`[UserService.submitKYC] 开始保存: userId=${userId}, realName=${realName}`);
    
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[UserService.submitKYC] 用户不存在: ${userId}`);
      throw new NotFoundError('用户不存在');
    }
    
    console.log(`[UserService.submitKYC] 找到用户: ${user.email}`);
    
    // 更新用户信息
    user.realName = realName;
    user.idCard = idCard;
    user.idCardFront = idCardFront;
    user.idCardBack = idCardBack;
    user.kycStatus = KYC_STATUS.PENDING;
    
    console.log(`[UserService.submitKYC] 准备保存到数据库...`);
    console.log(`[UserService.submitKYC] 数据: realName=${user.realName}, idCard=${user.idCard?.substring(0,6)}****, kycStatus=${user.kycStatus}`);
    
    // 保存到数据库
    const savedUser = await user.save();
    
    console.log(`[UserService.submitKYC] ✅ 保存成功! 用户 ${savedUser.email} 的 kycStatus=${savedUser.kycStatus}`);
    
    // 清除缓存
    clearCache('/api/users/profile');
    
    return savedUser;
  }

  /**
   * 撤回实名认证申请
   */
  static async withdrawKYC(userId) {
    console.log(`[UserService.withdrawKYC] 用户 ${userId} 请求撤回实名认证`);
    
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    // 只有待审核状态才能撤回
    if (user.kycStatus !== KYC_STATUS.PENDING) {
      console.log(`[UserService.withdrawKYC] 撤回失败: 当前状态为 ${user.kycStatus}`);
      throw new BadRequestError('当前状态无法撤回');
    }
    
    // 清空认证信息，恢复为未认证状态
    user.realName = null;
    user.idCard = null;
    user.idCardFront = null;
    user.idCardBack = null;
    user.kycStatus = KYC_STATUS.UNVERIFIED;
    
    await user.save();
    clearCache('/api/users/profile');
    
    console.log(`[UserService.withdrawKYC] ✅ 用户 ${userId} 已撤回实名认证申请`);
    
    return user;
  }

  /**
   * 更新 KYC 审核状态
   */
  static async updateKYCStatus(userId, status) {
    const validStatuses = [KYC_STATUS.VERIFIED, KYC_STATUS.REJECTED];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('无效的审核状态');
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('用户不存在');
    
    user.kycStatus = status;
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
        abnormalUsers.push({ 
          userId: user._id, 
          email: user.email, 
          reason: abnormalReason 
        });
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

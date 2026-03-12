/**
 * 用户服务 - 统一入口
 * 将所有模块的方法合并到一个 UserService 类中
 * 
 * 模块结构：
 * - user.service.base.js   - 基础方法（查找、注册、登录等）
 * - user.service.kyc.js    - KYC实名认证
 * - user.service.balance.js - 余额、经验、信誉、VIP
 * - user.service.team.js   - 团队、邀请、佣金
 * - user.service.points.js - 积分、小象币
 * - user.service.stats.js  - 统计、神秘商店
 */

import { UserServiceBase } from './user.service.base.js';
import { UserServiceKYC } from './user.service.kyc.js';
import { UserServiceBalance } from './user.service.balance.js';
import { UserServiceTeam } from './user.service.team.js';
import { UserServicePoints } from './user.service.points.js';
import { UserServiceStats } from './user.service.stats.js';

/**
 * 合并所有模块的静态方法到一个类中
 */
class UserServiceClass {
  // 从各模块复制所有静态方法
}

// 合并 Base 模块
Object.getOwnPropertyNames(UserServiceBase).forEach(name => {
  if (typeof UserServiceBase[name] === 'function') {
    UserServiceClass[name] = UserServiceBase[name];
  }
});

// 合并 KYC 模块
Object.getOwnPropertyNames(UserServiceKYC).forEach(name => {
  if (typeof UserServiceKYC[name] === 'function') {
    UserServiceClass[name] = UserServiceKYC[name];
  }
});

// 合并 Balance 模块
Object.getOwnPropertyNames(UserServiceBalance).forEach(name => {
  if (typeof UserServiceBalance[name] === 'function') {
    UserServiceClass[name] = UserServiceBalance[name];
  }
});

// 合并 Team 模块
Object.getOwnPropertyNames(UserServiceTeam).forEach(name => {
  if (typeof UserServiceTeam[name] === 'function') {
    UserServiceClass[name] = UserServiceTeam[name];
  }
});

// 合并 Points 模块
Object.getOwnPropertyNames(UserServicePoints).forEach(name => {
  if (typeof UserServicePoints[name] === 'function') {
    UserServiceClass[name] = UserServicePoints[name];
  }
});

// 合并 Stats 模块
Object.getOwnPropertyNames(UserServiceStats).forEach(name => {
  if (typeof UserServiceStats[name] === 'function') {
    UserServiceClass[name] = UserServiceStats[name];
  }
});

// 导出统一的 UserService
export const UserService = UserServiceClass;

// 默认导出
export default UserService;

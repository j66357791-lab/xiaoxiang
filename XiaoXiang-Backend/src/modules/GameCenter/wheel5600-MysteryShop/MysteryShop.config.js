// src/modules/wheel5600-MysteryShop/MysteryShop.config.js

/**
 * 神秘商店配置
 */

// 场阶门槛配置
export const MYSTERY_SHOP_THRESHOLDS = {
  novice: 10000,      // 菜鸟场：10,000 积分
  elite: 200000,      // 精英场：200,000 积分
  god: 1000000        // 大神场：1,000,000 积分
};

// 场阶名称映射
export const LEVEL_NAMES = {
  novice: '菜鸟场',
  elite: '精英场',
  god: '大神场'
};

// 场阶颜色
export const LEVEL_COLORS = {
  novice: '#4CAF50',
  elite: '#2196F3',
  god: '#FFD700'
};

/**
 * 奖励配置
 * weight: 权重（用于概率计算）
 * type: 奖励类型 (jackpot_percent, points, coins, balance)
 * value: 数值
 * description: 描述
 */
export const REWARDS_CONFIG = {
  // 菜鸟场奖励
  novice: [
    { weight: 5, type: 'jackpot_percent', value: 0.001, description: '奖池0.1%' },
    { weight: 3, type: 'jackpot_percent', value: 0.003, description: '奖池0.3%' },
    { weight: 2, type: 'jackpot_percent', value: 0.005, description: '奖池0.5%' },
    { weight: 40, type: 'points', value: 88, description: '88积分' },
    { weight: 10, type: 'points', value: 888, description: '888积分' },
    { weight: 5, type: 'points', value: 1888, description: '1888积分' },
    { weight: 1, type: 'coins', value: 0.5, description: '0.5小象币' },
    { weight: 20, type: 'balance', value: 1.88, description: '1.88元余额' },
    { weight: 10, type: 'balance', value: 3.88, description: '3.88元余额' },
    { weight: 4, type: 'balance', value: 8.88, description: '8.88元余额' },
  ],
  
  // 精英场奖励
  elite: [
    { weight: 5, type: 'jackpot_percent', value: 0.01, description: '奖池1%' },
    { weight: 3, type: 'jackpot_percent', value: 0.02, description: '奖池2%' },
    { weight: 2, type: 'jackpot_percent', value: 0.03, description: '奖池3%' },
    { weight: 40, type: 'points', value: 3888, description: '3888积分' },
    { weight: 10, type: 'points', value: 8888, description: '8888积分' },
    { weight: 5, type: 'points', value: 18888, description: '18888积分' },
    { weight: 1, type: 'coins', value: 10, description: '10小象币' },
    { weight: 20, type: 'balance', value: 66.6, description: '66.6元余额' },
    { weight: 12, type: 'balance', value: 88.8, description: '88.8元余额' },
    { weight: 2, type: 'balance', value: 188.8, description: '188.8元余额' },
  ],
  
  // 大神场奖励
  god: [
    { weight: 5, type: 'jackpot_percent', value: 0.06, description: '奖池6%' },
    { weight: 3, type: 'jackpot_percent', value: 0.12, description: '奖池12%' },
    { weight: 2, type: 'jackpot_percent', value: 0.18, description: '奖池18%' },
    { weight: 40, type: 'points', value: 18888, description: '18888积分' },
    { weight: 10, type: 'points', value: 88888, description: '88888积分' },
    { weight: 5, type: 'points', value: 128888, description: '128888积分' },
    { weight: 1, type: 'coins', value: 66, description: '66小象币' },
    { weight: 25, type: 'balance', value: 388.8, description: '388.8元余额' },
    { weight: 8, type: 'balance', value: 588.8, description: '588.8元余额' },
    { weight: 1, type: 'balance', value: 1888.8, description: '1888.8元余额' },
  ]
};

// 获取总权重
export const getTotalWeight = (level) => {
  const rewards = REWARDS_CONFIG[level] || [];
  return rewards.reduce((sum, r) => sum + r.weight, 0);
};

// src/WheelGame/WheelGame.config.js

// 9圈轮盘配置
export const ROUNDS_CONFIG = [
  { // 第1圈 - 简单
    sectors: [
      { type: 'multiplier', value: 1.1 },
      { type: 'multiplier', value: 1.2 },
      { type: 'multiplier', value: 1.3 },
      { type: 'multiplier', value: 1.4 },
      { type: 'multiplier', value: 1.5 },
      { type: 'multiplier', value: 1.6 },
      { type: 'multiplier', value: 1.7 },
      { type: 'multiplier', value: 1.8 },
      { type: 'multiplier', value: 1.9 },
      { type: 'death' }
    ]
  },
  { // 第2圈
    sectors: [
      { type: 'multiplier', value: 0.8 },
      { type: 'multiplier', value: 0.9 },
      { type: 'multiplier', value: 1.0 },
      { type: 'multiplier', value: 1.1 },
      { type: 'multiplier', value: 1.2 },
      { type: 'multiplier', value: 1.3 },
      { type: 'death' },
      { type: 'death' },
      { type: 'settle' }
    ]
  },
  { // 第3圈
    sectors: [
      { type: 'multiplier', value: 0.6 },
      { type: 'multiplier', value: 0.8 },
      { type: 'multiplier', value: 1.0 },
      { type: 'multiplier', value: 1.3 },
      { type: 'multiplier', value: 1.5 },
      { type: 'death' },
      { type: 'death' },
      { type: 'settle' }
    ]
  },
  { // 第4圈
    sectors: [
      { type: 'multiplier', value: 0.4 },
      { type: 'multiplier', value: 0.6 },
      { type: 'multiplier', value: 1.8 },
      { type: 'multiplier', value: 2.4 },
      { type: 'death' },
      { type: 'settle' },
      { type: 'settle' }
    ]
  },
  { // 第5圈
    sectors: [
      { type: 'multiplier', value: 0.2 },
      { type: 'multiplier', value: 0.4 },
      { type: 'multiplier', value: 2.0 },
      { type: 'multiplier', value: 3.0 },
      { type: 'death' },
      { type: 'settle' }
    ]
  },
  { // 第6圈
    sectors: [
      { type: 'multiplier', value: 0.2 },
      { type: 'multiplier', value: 4.0 },
      { type: 'settle' },
      { type: 'death' }
    ]
  },
  { // 第7圈
    sectors: [
      { type: 'multiplier', value: 0.1 },
      { type: 'multiplier', value: 6.0 },
      { type: 'settle' }
    ]
  },
  { // 第8圈
    sectors: [
      { type: 'death' },
      { type: 'multiplier', value: 8.8 },
      { type: 'settle' }
    ]
  },
  { // 第9圈 - 奖池圈
    sectors: [
      { type: 'jackpot', value: 0.01 },
      { type: 'jackpot', value: 0.02 },
      { type: 'jackpot', value: 0.03 },
      { type: 'jackpot', value: 0.04 },
      { type: 'jackpot', value: 0.05 },
      { type: 'jackpot', value: 0.06 },
      { type: 'jackpot', value: 0.07 },
      { type: 'jackpot', value: 0.08 }
    ]
  }
];

// 游戏常量
export const GAME_CONFIG = {
  TICKET_PRICE: 10,        // 门票价格
  SETTLE_FEE_RATE: 0.05,   // 结算手续费率 5%
  MAX_ROUNDS: 9,           // 最大圈数
};

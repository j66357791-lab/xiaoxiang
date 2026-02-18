// src/modules/GameCenter/flipcard/FlipCard.config.js

// 积分档位
export const BET_OPTIONS = [10, 50, 200, 500, 1000];

// 场次配置
export const LEVELS = {
  easy: { 
    name: '初级场', 
    turtle: 1, 
    rabbit: 15, 
    factor: 1.05, 
    totalCards: 16,
    color: '#2f542f',
    icon: '🐇'
  },
  medium: { 
    name: '中级场', 
    turtle: 3, 
    rabbit: 13, 
    factor: 1.15, 
    totalCards: 16,
    color: '#a7632b',
    icon: '🐢'
  },
  hard: { 
    name: '高级场', 
    turtle: 6, 
    rabbit: 10, 
    factor: 1.4, 
    totalCards: 16,
    color: '#b33b3b',
    icon: '🔥'
  },
  hell: { 
    name: '地狱场', 
    turtle: 12, 
    rabbit: 4, 
    factor: 3.0, 
    totalCards: 16,
    color: '#6b1b1b',
    icon: '💀'
  }
};

// 手续费率
export const FEE_RATE = 0.05; // 5%

// 积分档位
export const BET_OPTIONS = [10, 50, 200, 500, 1000];

// 场次配置
export const LEVELS = {
  easy: { name: '初级场', turtle: 1, rabbit: 15, factor: 1.05, totalCards: 16 },
  medium: { name: '中级场', turtle: 3, rabbit: 13, factor: 1.15, totalCards: 16 },
  hard: { name: '高级场', turtle: 6, rabbit: 10, factor: 1.25, totalCards: 16 },
  hell: { name: '地狱场', turtle: 12, rabbit: 4, factor: 1.5, totalCards: 16 }
};

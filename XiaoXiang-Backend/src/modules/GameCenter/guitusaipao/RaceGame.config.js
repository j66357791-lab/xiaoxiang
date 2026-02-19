// src/modules/GameCenter/guitusaipao/RaceGame.config.js

// 游戏阶段时间配置（毫秒）
export const PHASE_DURATIONS = {
  BETTING: 30000,    // 下注阶段 30秒
  RACING: 5000,      // 比赛阶段 5秒（动画时间）
  SETTLING: 5000,    // 结算阶段 5秒
};

// 完整周期
export const CYCLE_DURATION = PHASE_DURATIONS.BETTING + PHASE_DURATIONS.RACING + PHASE_DURATIONS.SETTLING;

// 下注选项（四档筹码）
export const BET_OPTIONS = [10, 100, 500, 1000];

// 赔率
export const ODDS = {
  turtle: 1.9,
  rabbit: 1.9,
};

// 基础速度（每秒前进百分比，根据5秒比赛时间调整）
export const BASE_SPEED = {
  turtle: 18,    // 乌龟基础速度稍慢
  rabbit: 22,    // 兔子基础速度稍快
};

// 随机事件配置
export const RACE_EVENTS = [
  { id: 'turtle_boost', name: '🐢 乌龟加速', target: 'turtle', multiplier: 1.8, duration: 1000, icon: '⚡', color: '#22C55E' },
  { id: 'rabbit_sleep', name: '🐰 兔子睡觉', target: 'rabbit', multiplier: 0.1, duration: 1500, icon: '💤', color: '#EF4444' },
  { id: 'rabbit_boost', name: '🐰 兔子冲刺', target: 'rabbit', multiplier: 2.0, duration: 1000, icon: '🔥', color: '#F97316' },
  { id: 'turtle_stuck', name: '🐢 乌龟卡住', target: 'turtle', multiplier: 0.15, duration: 1200, icon: '🌿', color: '#14B8A6' },
  { id: 'both_boost', name: '✨ 双倍激情', target: 'both', multiplier: 1.5, duration: 1000, icon: '💫', color: '#A855F7' },
  { id: 'carrot', name: '🥕 胡萝卜诱惑', target: 'rabbit', multiplier: 0.2, duration: 1500, icon: '🥕', color: '#F97316' },
  { id: 'rain', name: '🌧️ 下雨了', target: 'both', multiplier: 0.5, duration: 1500, icon: '🌧️', color: '#3B82F6' },
  { id: 'wind', name: '💨 顺风助力', target: 'both', multiplier: 1.4, duration: 1000, icon: '💨', color: '#06B6D4' },
];

// 游戏状态
export const GAME_PHASES = {
  BETTING: 'betting',
  RACING: 'racing',
  SETTLING: 'settling',
};

// 交易类型
export const TRANSACTION_TYPES = {
  BET: 'race_bet',
  REWARD: 'race_reward',
};

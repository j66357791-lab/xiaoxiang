// src/modules/GameCenter/guitusaipao/RaceGame.config.js

// 游戏阶段时间配置（毫秒）
export const PHASE_DURATIONS = {
  BETTING: 30000,    // 下注阶段 30秒
  RACING: 12000,     // 比赛阶段 12秒
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

// 基础速度（每秒前进百分比，根据12秒比赛时间调整）
export const BASE_SPEED = {
  turtle: 7.5,   // 12秒内约跑90%
  rabbit: 8.5,
};

// 随机事件配置
export const RACE_EVENTS = [
  { id: 'turtle_boost', name: '🐢 乌龟加速', target: 'turtle', multiplier: 1.8, duration: 3000, icon: '⚡', color: '#22C55E' },
  { id: 'rabbit_sleep', name: '🐰 兔子睡觉', target: 'rabbit', multiplier: 0.15, duration: 4000, icon: '💤', color: '#EF4444' },
  { id: 'rabbit_boost', name: '🐰 兔子冲刺', target: 'rabbit', multiplier: 2.2, duration: 2000, icon: '🔥', color: '#F97316' },
  { id: 'turtle_stuck', name: '🐢 乌龟卡住', target: 'turtle', multiplier: 0.2, duration: 3000, icon: '🌿', color: '#14B8A6' },
  { id: 'both_boost', name: '✨ 双倍激情', target: 'both', multiplier: 1.5, duration: 2500, icon: '💫', color: '#A855F7' },
  { id: 'carrot', name: '🥕 胡萝卜诱惑', target: 'rabbit', multiplier: 0.3, duration: 3000, icon: '🥕', color: '#F97316' },
  { id: 'rain', name: '🌧️ 下雨了', target: 'both', multiplier: 0.6, duration: 3500, icon: '🌧️', color: '#3B82F6' },
  { id: 'wind', name: '💨 顺风助力', target: 'both', multiplier: 1.4, duration: 2000, icon: '💨', color: '#06B6D4' },
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

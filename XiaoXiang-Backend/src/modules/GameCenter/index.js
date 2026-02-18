// server/src/modules/GameCenter/index.js
/**
 * 游戏中心统一入口
 */

// ==================== 统计模块 ====================
export { GameStatsService } from './stats/GameStats.service.js';
export { GameStatsController } from './stats/GameStats.controller.js';
export { gameStatsRoutes } from './stats/GameStats.routes.js';

// ==================== 转盘游戏 ====================
export { default as wheelGameRoutes } from './WheelGame/WheelGame.routes.js';
export { default as WheelGame } from './WheelGame/WheelGame.models.js';
export { default as Jackpot } from './WheelGame/Jackpot.models.js';

// ==================== 神秘商店 ====================
export { default as mysteryShopRoutes } from './wheel5600-MysteryShop/MysteryShop.routes.js';
export { MysteryShopService } from './wheel5600-MysteryShop/MysteryShop.service.js';

// ==================== 猜拳游戏 ====================
export { default as gamescaiquanRoutes } from './gamescaiquan/gamescaiquan.routes.js';
export { GameScaiquanService } from './gamescaiquan/gamescaiquan.service.js';

// ==================== 翻牌游戏 ====================
export { default as flipcardRoutes } from './flipcard/FlipCard.routes.js';
console.log('[GameCenter] 🎮 游戏中心模块加载完成');

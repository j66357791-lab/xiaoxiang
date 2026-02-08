// src/common/middlewares/cache.js

/**
 * 简单的内存缓存中间件
 * 用于后端拦截请求，减少数据库查询
 */
const cacheStore = new Map();

export const cacheMiddleware = (durationSeconds = 30) => {
  return (req, res, next) => {
    // 只缓存 GET 请求，POST/PUT/DELETE 不缓存
    if (req.method !== 'GET') return next();

    const key = req.originalUrl || req.url;

    // 1. 检查缓存是否存在且未过期
    if (cacheStore.has(key)) {
      const cachedData = cacheStore.get(key);
      const now = new Date().getTime();

      if (now - cachedData.timestamp < durationSeconds * 1000) {
        console.log(`[Cache Hit] ${key}`);
        // 返回缓存数据
        return res.status(200).json(cachedData.data);
      } else {
        cacheStore.delete(key); // 过期了，删掉
      }
    }

    // 2. 没有缓存，拦截 res.json，把结果存入缓存
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (body && body.success) {
        cacheStore.set(key, {
          data: body,
          timestamp: new Date().getTime()
        });
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * 手动清除缓存
 * @param {string} url - 要清除的 API 路径，例如 '/api/users/profile'
 */
export const clearCache = (url) => {
  if (url === '*') {
    cacheStore.clear();
    console.log('所有缓存已清除');
  } else {
    cacheStore.delete(url);
    console.log(`缓存已清除: ${url}`);
  }
};

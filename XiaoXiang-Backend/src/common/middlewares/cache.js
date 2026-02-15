// src/common/middlewares/cache.js

const cacheStore = new Map();

export const cacheMiddleware = (durationSeconds = 30) => {
  return (req, res, next) => {
    try {
      // 1. 只缓存 GET 请求
      if (req.method !== 'GET') return next();

      const key = req.originalUrl || req.url;

      // 2. 检查缓存
      if (cacheStore.has(key)) {
        const cachedData = cacheStore.get(key);
        const now = new Date().getTime();

        if (now - cachedData.timestamp < durationSeconds * 1000) {
          console.log(`[Cache Hit] ${key}`);
          // 返回缓存数据，这里一定要 return，防止后续执行
          return res.status(200).json(cachedData.data);
        } else {
          cacheStore.delete(key); // 过期删除
        }
      }

      // 3. 没有缓存，拦截 res.json
      // 先绑定原方法
      const originalJson = res.json.bind(res);
      
      // 覆盖 res.json
      res.json = function (body) {
        try {
          // 仅缓存成功的响应 (status 200 且包含 success: true)
          if (res.statusCode === 200 && body && body.success) {
            cacheStore.set(key, {
              data: body,
              timestamp: new Date().getTime()
            });
            console.log(`[Cache Stored] ${key}`);
          }
        } catch (err) {
          // 这里如果出错，绝不能影响响应发送，只打印日志
          console.error(`[Cache Store Error] ${key}:`, err.message);
        }
        
        // 必须调用原始方法，否则请求会卡死
        return originalJson(body);
      };

      // 4. 放行给路由
      next();

    } catch (error) {
      // 如果中间件本身抛出异常（例如 Map 操作失败），记录错误并放行
      console.error('[Cache Middleware Error]:', error);
      next(); 
    }
  };
};

export const clearCache = (url) => {
  if (url === '*') {
    cacheStore.clear();
    console.log('[Cache Cleared] All');
  } else {
    cacheStore.delete(url);
    console.log(`[Cache Cleared] ${url}`);
  }
};

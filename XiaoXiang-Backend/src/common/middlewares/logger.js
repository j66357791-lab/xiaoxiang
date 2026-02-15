/**
 * 自定义日志中间件
 */
export const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

  // 请求完成时记录响应状态
  res.on('finish', () => {
    console.log(`[${timestamp}] ${method} ${url} - 状态: ${res.statusCode} - IP: ${ip}`);
  });

  next();
};

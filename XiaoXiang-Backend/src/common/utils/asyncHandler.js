/**
 * 异步路由处理器包装器
 * 捕获 async 函数中的错误并传递给 Express 错误处理中间件
 * 
 * @param {Function} fn - 异步处理函数
 * @returns {Function} - Express 中间件函数
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

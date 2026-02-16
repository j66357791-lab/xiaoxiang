import { AppError } from '../utils/error.js';

/**
 * 全局错误处理中间件
 * 必须在所有路由之后注册
 */
export const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  console.error('❌ [Error Handler]', {
    path: `${req.method} ${req.path}`,
    name: err.name,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });

  // 自定义应用错误
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // Mongoose 验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  // MongoDB 重复键错误
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} 已存在`
    });
  }

  // Mongoose CastError（无效的 ObjectId）
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: '无效的 ID 格式'
    });
  }

  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误，请稍后重试'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 处理中间件
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API 路由不存在',
    path: req.originalUrl,
    method: req.method
  });
};

/**
 * 自定义应用错误基类
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true; // 标记为可捕获的预期错误
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 资源不存在
 */
export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404);
  }
}

/**
 * 400 请求参数错误
 */
export class BadRequestError extends AppError {
  constructor(message = '请求参数错误') {
    super(message, 400);
  }
}

/**
 * 401 未授权
 */
export class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401);
  }
}

/**
 * 403 禁止访问
 */
export class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403);
  }
}

/**
 * 409 冲突（如重复注册）
 */
export class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409);
  }
}

/**
 * 429 请求过于频繁
 */
export class TooManyRequestsError extends AppError {
  constructor(message = '请求过于频繁') {
    super(message, 429);
  }
}

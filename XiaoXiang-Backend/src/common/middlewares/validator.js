import { BadRequestError } from '../utils/error.js';

/**
 * Joi 参数验证中间件
 * @param {Object} schema - Joi 验证规则
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false, // 返回所有错误
      stripUnknown: true // 删除未定义的字段
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      throw new BadRequestError('参数验证失败', errors);
    }

    next();
  };
};

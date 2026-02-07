/**
 * 统一成功响应
 * @param {Object} res - Express response 对象
 * @param {*} data - 返回的数据
 * @param {string} message - 提示信息
 * @param {number} statusCode - HTTP 状态码
 */
export const success = (res, data = null, message = '操作成功', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * 统一错误响应（供 controller 直接使用）
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误信息
 * @param {number} statusCode - HTTP 状态码
 * @param {*} errorDetails - 错误详情（开发环境返回）
 */
export const error = (res, message = '操作失败', statusCode = 500, errorDetails = null) => {
  const response = {
    success: false,
    message
  };

  // 开发环境下返回错误详情
  if (errorDetails && process.env.NODE_ENV !== 'production') {
    response.error = errorDetails;
  }

  return res.status(statusCode).json(response);
};

/**
 * 分页响应格式
 * @param {Object} res - Express response 对象
 * @param {Array} data - 数据列表
 * @param {Object} pagination - 分页信息
 * @param {string} message - 提示信息
 */
export const paginated = (res, data, pagination, message = '获取成功') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(pagination.page),
      limit: parseInt(pagination.limit),
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit)
    }
  });
};

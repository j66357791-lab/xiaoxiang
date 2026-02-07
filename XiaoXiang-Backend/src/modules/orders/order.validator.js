import Joi from 'joi';

export const orderValidators = {
  // 接单
  applyJob: Joi.object({
    jobId: Joi.string().required().messages({
      'any.required': '任务ID不能为空'
    }),
    levelIndex: Joi.number().integer().min(0).optional()
  }),

  // 提交订单
  submitOrder: Joi.object({
    orderId: Joi.string().required().messages({
      'any.required': '订单ID不能为空'
    }),
    description: Joi.string().max(200).allow('').messages({
      'string.max': '描述不能超过200字'
    })
  }),

  // 更新订单状态
  updateStatus: Joi.object({
    status: Joi.string().valid(
      'Applied', 'Submitted', 'Reviewing',
      'PendingPayment', 'Completed', 'Cancelled', 'Rejected'
    ).required().messages({
      'any.required': '状态不能为空',
      'any.only': '无效的订单状态'
    })
  })
};

import Joi from 'joi';

export const withdrawalValidators = {
  // 申请提现
  requestWithdrawal: Joi.object({
    amount: Joi.number().positive().required().messages({
      'number.positive': '提现金额必须大于0',
      'any.required': '提现金额不能为空'
    })
  }),

  // 审核提现
  auditWithdrawal: Joi.object({
    status: Joi.string().valid('Approved', 'Rejected', 'Completed').required().messages({
      'any.required': '状态不能为空',
      'any.only': '无效的状态'
    }),
    remark: Joi.string().optional()
  })
};

import Joi from 'joi';

export const jobValidators = {
  createJob: Joi.object({
    title: Joi.string().required().messages({ 'any.required': '任务标题不能为空' }),
    content: Joi.string().required().messages({ 'any.required': '任务内容不能为空' }),
    categoryId: Joi.string().required().messages({ 'any.required': '分类不能为空' }),
    amount: Joi.number().min(0).allow(''),
    totalSlots: Joi.number().integer().min(1).required().messages({
      'any.required': '任务名额不能为空',
      'number.min': '名额至少为1'
    }),
    deadlineHours: Joi.number().integer().min(1).required().messages({
      'any.required': '截止时间不能为空',
      'number.min': '截止时间至少1小时'
    }),
    type: Joi.string().valid('single', 'multi').optional(),
    amountLevels: Joi.string().optional(),
    steps: Joi.string().optional(),
    contentImages: Joi.array().items(Joi.string()).optional(),
    depositRequirement: Joi.number().min(0).optional(),
    kycRequired: Joi.boolean().optional()
  })
};

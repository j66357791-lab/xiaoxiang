import Joi from 'joi';

export const jobValidators = {
  createJob: Joi.object({
    title: Joi.string().required().messages({ 'any.required': '任务标题不能为空' }),
    subtitle: Joi.string().allow(null, '').optional(),
    content: Joi.string().required().messages({ 'any.required': '任务内容不能为空' }),
    
    // 分类
    category1: Joi.string().allow(null, '').optional(),
    category2: Joi.string().allow(null, '').optional(),
    category3: Joi.string().allow(null, '').optional(),
    
    // 金额
    amount: Joi.number().min(0).allow(null, '').optional(),
    
    // 名额
    totalSlots: Joi.number().integer().min(1).required().messages({
      'any.required': '任务名额不能为空',
      'number.min': '名额至少为1'
    }),
    
    // 截止时间
    deadlineHours: Joi.number().integer().min(1).required().messages({
      'any.required': '截止时间不能为空',
      'number.min': '截止时间至少1小时'
    }),
    
    // 金额等级
    amountLevels: Joi.array().items(
      Joi.object({
        level: Joi.string().required(),
        amount: Joi.number().required()
      })
    ).optional(),
    
    // 步骤
    steps: Joi.array().items(
      Joi.object({
        text: Joi.string().allow('').required(),
        image: Joi.string().allow('').optional()
      })
    ).optional(),
    
    // 图片
    contentImages: Joi.array().items(Joi.string()).optional(),
    
    // 其他字段
    depositRequirement: Joi.number().min(0).optional(),
    kycRequired: Joi.boolean().optional(),
    isRepeatable: Joi.boolean().optional(),
    scheduledAt: Joi.string().isoDate().allow(null).optional(),
    endAt: Joi.string().isoDate().allow(null).optional()
  }),

  // 👇👇👇 【新增】更新任务验证 👇👇👇
  updateJob: Joi.object({
    title: Joi.string().optional(),
    subtitle: Joi.string().allow(null, '').optional(),
    content: Joi.string().optional(),
    description: Joi.string().allow(null, '').optional(),
    
    // 分类
    categoryL1: Joi.string().allow(null).optional(),
    categoryL2: Joi.string().allow(null).optional(),
    categoryL3: Joi.string().allow(null).optional(),
    
    // 金额
    amount: Joi.number().min(0).optional(),
    
    // 名额
    totalSlots: Joi.number().integer().min(1).optional(),
    
    // 截止时间
    deadline: Joi.string().isoDate().allow(null).optional(),
    
    // 其他字段
    depositRequirement: Joi.number().min(0).optional(),
    kycRequired: Joi.boolean().optional(),
    isRepeatable: Joi.boolean().optional(),
    isFrozen: Joi.boolean().optional()
  })
  // 👆👆👆 【新增结束】👆👆👆
};

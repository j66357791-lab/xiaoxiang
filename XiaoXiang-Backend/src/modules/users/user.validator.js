import Joi from 'joi';

/**
 * 参数验证规则
 */
export const userValidators = {
  // 注册
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': '请输入有效的邮箱地址',
      'any.required': '邮箱不能为空'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': '密码至少6位',
      'any.required': '密码不能为空'
    })
  }),

  // 登录
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': '请输入有效的邮箱地址',
      'any.required': '邮箱不能为空'
    }),
    password: Joi.string().required().messages({
      'any.required': '密码不能为空'
    })
  }),

  // 更新保证金
  updateDeposit: Joi.object({
    amount: Joi.number().min(0).required().messages({
      'number.min': '保证金不能为负数',
      'any.required': '请输入保证金金额'
    })
  }),

  // 更新 KYC 状态
  updateKYCStatus: Joi.object({
    status: Joi.string().valid('Verified', 'Rejected').required().messages({
      'any.required': '请选择审核状态',
      'any.only': '审核状态必须是 Verified 或 Rejected'
    })
  }),

  // 提交 KYC
  submitKYC: Joi.object({
    userId: Joi.string().required().messages({
      'any.required': '用户ID不能为空'
    }),
    idCard: Joi.string().required().messages({
      'any.required': '身份证号不能为空'
    })
  }),

  // 🆕 积分增加
  addPoints: Joi.object({
    amount: Joi.number().min(1).required().messages({
      'number.min': '积分必须大于0',
      'any.required': '积分数量不能为空'
    }),
    description: Joi.string().max(100).optional()
  }),

  // 🆕 积分扣除
  subtractPoints: Joi.object({
    amount: Joi.number().min(1).required().messages({
      'number.min': '积分必须大于0',
      'any.required': '积分数量不能为空'
    }),
    description: Joi.string().max(100).optional()
  }),

  // 🆕 小象币增加
  addCoins: Joi.object({
    amount: Joi.number().min(1).required().messages({
      'number.min': '小象币必须大于0',
      'any.required': '小象币数量不能为空'
    }),
    description: Joi.string().max(100).optional()
  }),

  // 🆕 小象币扣除
  subtractCoins: Joi.object({
    amount: Joi.number().min(1).required().messages({
      'number.min': '小象币必须大于0',
      'any.required': '小象币数量不能为空'
    }),
    description: Joi.string().max(100).optional()
  }),

  // 🆕 积分兑换小象币
  exchangePointsForCoins: Joi.object({
    points: Joi.number().min(1).required().messages({
      'number.min': '积分必须大于0',
      'any.required': '积分数量不能为空'
    }),
    coinsRate: Joi.number().min(1).optional()
  }),

  // 🆕 小象币兑换积分
  exchangeCoinsForPoints: Joi.object({
    coins: Joi.number().min(1).required().messages({
      'number.min': '小象币必须大于0',
      'any.required': '小象币数量不能为空'
    }),
    pointsRate: Joi.number().min(1).optional()
  })
};

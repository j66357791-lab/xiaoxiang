import Joi from 'joi';

export const authValidators = {
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

  // KYC
  submitKYC: Joi.object({
    userId: Joi.string().required().messages({
      'any.required': '用户ID不能为空'
    }),
    idCard: Joi.string().required().messages({
      'any.required': '身份证号不能为空'
    })
  })
};

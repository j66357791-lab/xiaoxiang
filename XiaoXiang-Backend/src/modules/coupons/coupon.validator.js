// src/modules/coupons/coupon.validator.js
// 优惠券验证器

import Joi from 'joi';

export const couponValidators = {
  // 创建优惠券
  createCoupon: Joi.object({
    code: Joi.string().alphanum().min(4).max(20).optional().messages({
      'string.min': '优惠券码至少4个字符',
      'string.max': '优惠券码最多20个字符',
    }),
    name: Joi.string().required().min(2).max(50).messages({
      'any.required': '优惠券名称不能为空',
      'string.min': '名称至少2个字符',
      'string.max': '名称最多50个字符',
    }),
    description: Joi.string().max(200).allow('').optional(),
    type: Joi.string().valid('fixed', 'percent').required().messages({
      'any.required': '请选择优惠类型',
      'any.only': '优惠类型无效',
    }),
    value: Joi.number().positive().required().messages({
      'any.required': '优惠值不能为空',
      'number.positive': '优惠值必须大于0',
    }),
    minAmount: Joi.number().min(0).default(0),
    maxDiscount: Joi.number().min(0).optional(),
    totalCount: Joi.number().integer().min(1).required().messages({
      'any.required': '发放总量不能为空',
      'number.min': '发放总量至少为1',
    }),
    perUserLimit: Joi.number().integer().min(1).default(1),
    startTime: Joi.date().iso().required().messages({
      'any.required': '开始时间不能为空',
    }),
    endTime: Joi.date().iso().min(Joi.ref('startTime')).required().messages({
      'any.required': '结束时间不能为空',
      'date.min': '结束时间必须晚于开始时间',
    }),
    applicableCategories: Joi.array().items(Joi.string()).optional(),
    applicableJobs: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid('active', 'inactive').default('active'),
    sort: Joi.number().integer().min(0).default(0),
  }),
  
  // 更新优惠券
  updateCoupon: Joi.object({
    code: Joi.string().alphanum().min(4).max(20).optional(),
    name: Joi.string().min(2).max(50).optional(),
    description: Joi.string().max(200).allow('').optional(),
    type: Joi.string().valid('fixed', 'percent').optional(),
    value: Joi.number().positive().optional(),
    minAmount: Joi.number().min(0).optional(),
    maxDiscount: Joi.number().min(0).optional(),
    totalCount: Joi.number().integer().min(1).optional(),
    perUserLimit: Joi.number().integer().min(1).optional(),
    startTime: Joi.date().iso().optional(),
    endTime: Joi.date().iso().optional(),
    applicableCategories: Joi.array().items(Joi.string()).optional(),
    applicableJobs: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid('active', 'inactive', 'expired').optional(),
    sort: Joi.number().integer().min(0).optional(),
  }),
  
  // 领取优惠券
  claimCoupon: Joi.object({
    couponId: Joi.string().required().messages({
      'any.required': '优惠券ID不能为空',
    }),
  }),
  
  // 通过码领取
  claimByCode: Joi.object({
    code: Joi.string().required().messages({
      'any.required': '优惠券码不能为空',
    }),
  }),
  
  // 验证优惠券
  validateCoupon: Joi.object({
    couponId: Joi.string().required().messages({
      'any.required': '优惠券ID不能为空',
    }),
    amount: Joi.number().min(0).default(0),
    jobId: Joi.string().optional(),
  }),
  
  // 更新状态
  updateStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'expired').required().messages({
      'any.required': '状态不能为空',
      'any.only': '无效的状态',
    }),
  }),
};

import { body } from 'express-validator';

export const publishTaskRules = [
  body('productId').notEmpty().withMessage('商品ID不能为空'),
  body('recyclePrice').isNumeric().withMessage('回收价必须是数字'),
  body('quantity').isInt({ min: 1 }).withMessage('数量必须是正整数'),
];

export const bindSaleRules = [
  body('platformName').notEmpty().withMessage('平台名称不能为空'),
  body('platformOrderNo').notEmpty().withMessage('平台订单号不能为空'),
  body('salePrice').isNumeric().withMessage('售价必须是数字'),
];

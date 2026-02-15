import { body } from 'express-validator';

export const createProductRules = [
  body('name').notEmpty().withMessage('商品名称不能为空'),
  body('categoryId').notEmpty().withMessage('分类ID不能为空'),
  body('costPrice').isNumeric().withMessage('成本价必须是数字'),
  body('sellPrice').isNumeric().withMessage('售价必须是数字'),
];

export const adjustStockRules = [
  body('newStock').isInt({ min: 0 }).withMessage('库存必须是非负整数'),
  body('reason').notEmpty().withMessage('调整原因不能为空'),
];

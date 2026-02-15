/**
 * 用户角色
 */
export const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'superAdmin'
};

/**
 * 订单状态
 */
export const ORDER_STATUS = {
  APPLIED: 'Applied',           // 已接单
  SUBMITTED: 'Submitted',       // 已提交
  REVIEWING: 'Reviewing',       // 审核中
  PENDING_PAYMENT: 'PendingPayment', // 待打款
  COMPLETED: 'Completed',       // 已完成
  CANCELLED: 'Cancelled',       // 已取消
  REJECTED: 'Rejected'          // 已驳回
};

/**
 * 交易类型
 */
export const TRANSACTION_TYPE = {
  INCOME: 'income',     // 收入
  WITHDRAW: 'withdraw', // 提现
  RECHARGE: 'recharge'  // 充值
};

/**
 * 交易状态
 */
export const TRANSACTION_STATUS = {
  COMPLETED: 'completed',
  PENDING: 'pending'
};

/**
 * 提现状态
 */
export const WITHDRAWAL_STATUS = {
  PENDING: 'Pending',     // 待审核
  APPROVED: 'Approved',   // 已通过
  REJECTED: 'Rejected',   // 已拒绝
  COMPLETED: 'Completed'  // 已打款
};

/**
 * 支付方式类型
 */
export const PAYMENT_METHOD_TYPE = {
  ALIPAY: 'alipay',
  WECHAT: 'wechat',
  BANK: 'bank'
};

/**
 * 支付方式状态
 */
export const PAYMENT_METHOD_STATUS = {
  PENDING: 'Pending',   // 待审核
  APPROVED: 'Approved', // 已通过
  REJECTED: 'Rejected'  // 已拒绝
};

/**
 * 用户 KYC 状态
 */
export const KYC_STATUS = {
  PENDING: 'Pending',   // 待审核
  VERIFIED: 'Verified', // 已认证
  REJECTED: 'Rejected'  // 已拒绝
};

/**
 * 极简校验器 - 用于内测阶段
 * 移除复杂规则，只检查非空和基础长度
 */

export const simpleAuthValidator = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: '邮箱和密码不能为空'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密码长度至少6位'
    });
  }

  // 内测阶段，不做严格的邮箱正则校验
  next();
};

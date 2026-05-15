const jwt = require('jsonwebtoken');
const MallUser = require('../models/MallUser');

const CUSTOMER_JWT_SECRET = process.env.USER_JWT_SECRET || 'agent-mall-user-secret';
const CUSTOMER_JWT_EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN || '7d';

/**
 * 为前台用户签发访问令牌。
 */
function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      scope: 'mall_user'
    },
    CUSTOMER_JWT_SECRET,
    { expiresIn: CUSTOMER_JWT_EXPIRES_IN }
  );
}

/**
 * 校验前台用户登录态。
 */
async function authenticateCustomer(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '未登录或登录已失效' });
    }

    const token = authHeader.slice(7).trim();
    const payload = jwt.verify(token, CUSTOMER_JWT_SECRET);
    const user = await MallUser.getById(payload.sub);

    if (!user || Number(user.status) !== 1) {
      return res.status(401).json({ success: false, message: '账号不存在或已被禁用' });
    }

    req.customerAuth = {
      token,
      payload,
      user: MallUser.sanitize(user)
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
  }
}

module.exports = {
  signUserToken,
  authenticateCustomer
};

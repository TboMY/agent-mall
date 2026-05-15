const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'agent-mall-admin-secret';
const JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '7d';

/**
 * 为管理员账号签发后台访问令牌。
 */
function signAdminToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * 解析当前请求头中的 Bearer Token。
 */
function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

/**
 * 将管理员信息附加到请求对象上，供后续权限判断复用。
 */
async function authenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登录或登录已失效'
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await AdminUser.getById(payload.sub);

    if (!user || Number(user.status) !== 1) {
      return res.status(401).json({
        success: false,
        message: '账号不存在或已被禁用'
      });
    }

    req.auth = {
      token,
      payload,
      user: AdminUser.sanitize(user)
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '登录已过期，请重新登录'
    });
  }
}

/**
 * 要求当前登录用户具备指定权限。
 */
function requirePermission(permission) {
  return async function permissionMiddleware(req, res, next) {
    return authenticate(req, res, () => {
      const userPermissions = req.auth?.user?.permissions || [];
      if (permission && !userPermissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: '没有权限执行该操作',
          permission
        });
      }

      return next();
    });
  };
}

/**
 * 将当前登录用户信息序列化为前端所需结构。
 */
function buildAuthPayload(user) {
  const safeUser = AdminUser.sanitize(user);
  return {
    user: safeUser,
    permissions: safeUser.permissions || []
  };
}

module.exports = {
  authenticate,
  requirePermission,
  signAdminToken,
  buildAuthPayload
};

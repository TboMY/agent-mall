const express = require('express');
const Joi = require('joi');

const AdminUser = require('../models/AdminUser');
const AdminRole = require('../models/AdminRole');
const { validate } = require('../middleware/validation');
const { authenticate, requirePermission, signAdminToken, buildAuthPayload } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

const adminUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required().messages({
    'string.empty': '用户名不能为空',
    'string.min': '用户名至少需要3个字符',
    'string.max': '用户名不能超过50个字符'
  }),
  email: Joi.string().allow('', null).email().max(100),
  phone: Joi.string().allow('', null).max(20),
  role: Joi.string().trim().min(2).max(50).required(),
  status: Joi.number().integer().valid(0, 1).default(1),
  password: Joi.string().min(6).max(50).required().messages({
    'string.min': '密码至少需要6个字符'
  })
});

const adminUserUpdateSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().allow('', null).email().max(100),
  phone: Joi.string().allow('', null).max(20),
  role: Joi.string().trim().min(2).max(50).required(),
  status: Joi.number().integer().valid(0, 1).required()
});

const passwordSchema = Joi.object({
  password: Joi.string().min(6).max(50).required().messages({
    'string.min': '密码至少需要6个字符'
  })
});

const selfPasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(50).required().messages({
    'string.min': '新密码至少需要6个字符'
  })
});

/**
 * 统一检查超级管理员兜底，避免把最后一个超级管理员禁用、降级或删除。
 */
async function ensureSuperAdminSafety(targetUser, nextRole, nextStatus) {
  const isLastSuperAdmin = targetUser.role === 'super_admin'
    && Number(targetUser.status) === 1
    && await AdminUser.countActiveSuperAdmins(targetUser.id) === 0;

  if (!isLastSuperAdmin) {
    return null;
  }

  if (nextRole && nextRole !== 'super_admin') {
    return '不能修改最后一个超级管理员的角色';
  }

  if (nextStatus !== undefined && Number(nextStatus) !== 1) {
    return '不能禁用最后一个超级管理员';
  }

  return null;
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入用户名和密码'
      });
    }

    const user = await AdminUser.getByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    if (Number(user.status) !== 1) {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用，请联系管理员'
      });
    }

    const matched = await AdminUser.verifyPassword(password, user.password);
    if (!matched) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    await AdminUser.markLoginSuccess(user.id);
    const token = signAdminToken(user);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        ...buildAuthPayload(user)
      }
    });
  } catch (error) {
    console.error('管理员登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: error.message
    });
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: buildAuthPayload(req.auth.user)
  });
});

router.get('/roles', authenticate, async (req, res) => {
  const roles = await AdminRole.getActiveRoles();
  res.json({
    success: true,
    data: roles.map(role => ({ value: role.code, label: role.name }))
  });
});

router.patch('/me/password', authenticate, validate(selfPasswordSchema), async (req, res) => {
  try {
    const currentUser = await AdminUser.getById(req.auth.user.id);
    const matched = await AdminUser.verifyPassword(req.body.oldPassword, currentUser.password);

    if (!matched) {
      return res.status(400).json({
        success: false,
        message: '原密码错误'
      });
    }

    await AdminUser.updatePassword(req.auth.user.id, req.body.newPassword);
    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改个人密码失败:', error);
    res.status(500).json({
      success: false,
      message: '修改密码失败',
      error: error.message
    });
  }
});

router.get('/', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  try {
    const result = await AdminUser.list({
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      search: req.query.search || '',
      role: req.query.role || '',
      status: req.query.status
    });

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取管理员列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取管理员列表失败',
      error: error.message
    });
  }
});

router.post('/', requirePermission(PERMISSIONS.USERS_MANAGE), validate(adminUserSchema), async (req, res) => {
  try {
    if (req.body.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: '不允许新增超级管理员账号'
      });
    }

    const exists = await AdminUser.getByUsername(req.body.username);
    if (exists) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在'
      });
    }

    const role = await AdminRole.getByCode(req.body.role);
    if (!role || Number(role.status) !== 1) {
      return res.status(400).json({
        success: false,
        message: '所选角色不存在或已被禁用'
      });
    }

    const id = await AdminUser.create(req.body);
    res.status(201).json({
      success: true,
      message: '管理员创建成功',
      data: { id }
    });
  } catch (error) {
    console.error('创建管理员失败:', error);
    res.status(500).json({
      success: false,
      message: '创建管理员失败',
      error: error.message
    });
  }
});

router.put('/:id', requirePermission(PERMISSIONS.USERS_MANAGE), validate(adminUserUpdateSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    const existing = await AdminUser.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '管理员不存在' });
    }

    const userWithSameName = await AdminUser.getByUsername(req.body.username);
    if (userWithSameName && Number(userWithSameName.id) !== id) {
      return res.status(409).json({ success: false, message: '用户名已存在' });
    }

    if (existing.role !== 'super_admin' && req.body.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: '不允许将管理员升级为超级管理员'
      });
    }

    const role = await AdminRole.getByCode(req.body.role);
    if (!role || Number(role.status) !== 1) {
      return res.status(400).json({
        success: false,
        message: '所选角色不存在或已被禁用'
      });
    }

    if (Number(req.auth.user.id) === id && Number(req.body.status) !== 1) {
      return res.status(400).json({ success: false, message: '不能禁用当前登录账号' });
    }

    const safetyError = await ensureSuperAdminSafety(existing, req.body.role, req.body.status);
    if (safetyError) {
      return res.status(400).json({ success: false, message: safetyError });
    }

    await AdminUser.update(id, req.body);
    res.json({ success: true, message: '管理员更新成功' });
  } catch (error) {
    console.error('更新管理员失败:', error);
    res.status(500).json({
      success: false,
      message: '更新管理员失败',
      error: error.message
    });
  }
});

router.patch('/:id/status', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    if (Number.isNaN(id) || ![0, 1].includes(Number(status))) {
      return res.status(400).json({ success: false, message: '参数不合法' });
    }

    const existing = await AdminUser.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '管理员不存在' });
    }

    if (Number(req.auth.user.id) === id && Number(status) !== 1) {
      return res.status(400).json({ success: false, message: '不能禁用当前登录账号' });
    }

    const safetyError = await ensureSuperAdminSafety(existing, existing.role, status);
    if (safetyError) {
      return res.status(400).json({ success: false, message: safetyError });
    }

    await AdminUser.updateStatus(id, status);
    res.json({ success: true, message: '状态更新成功' });
  } catch (error) {
    console.error('更新管理员状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新管理员状态失败',
      error: error.message
    });
  }
});

router.patch('/:id/password', requirePermission(PERMISSIONS.USERS_MANAGE), validate(passwordSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    const existing = await AdminUser.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '管理员不存在' });
    }

    await AdminUser.updatePassword(id, req.body.password);
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({
      success: false,
      message: '重置密码失败',
      error: error.message
    });
  }
});

router.delete('/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    if (Number(req.auth.user.id) === id) {
      return res.status(400).json({ success: false, message: '不能删除当前登录账号' });
    }

    const existing = await AdminUser.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '管理员不存在' });
    }

    const safetyError = await ensureSuperAdminSafety(existing, existing.role, 0);
    if (safetyError) {
      return res.status(400).json({ success: false, message: safetyError.replace('禁用', '删除') });
    }

    await AdminUser.delete(id);
    res.json({ success: true, message: '管理员删除成功' });
  } catch (error) {
    console.error('删除管理员失败:', error);
    res.status(500).json({
      success: false,
      message: '删除管理员失败',
      error: error.message
    });
  }
});

module.exports = router;

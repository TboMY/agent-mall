const express = require('express');
const Joi = require('joi');

const AdminRole = require('../models/AdminRole');
const { validate } = require('../middleware/validation');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

const roleSchema = Joi.object({
  code: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z0-9_]+$/).required().messages({
    'string.pattern.base': '角色编码只能包含字母、数字和下划线'
  }),
  name: Joi.string().trim().min(2).max(50).required(),
  description: Joi.string().allow('', null).max(255),
  status: Joi.number().integer().valid(0, 1).default(1),
  permissions: Joi.array().items(Joi.string()).required()
});

const roleUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  description: Joi.string().allow('', null).max(255),
  status: Joi.number().integer().valid(0, 1).required(),
  permissions: Joi.array().items(Joi.string()).required()
});

router.use(requirePermission(PERMISSIONS.ROLES_MANAGE));

router.get('/permission-catalog', async (req, res) => {
  res.json({
    success: true,
    data: AdminRole.getPermissionCatalog()
  });
});

router.get('/', async (req, res) => {
  try {
    const result = await AdminRole.list({
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      search: req.query.search || '',
      status: req.query.status
    });
    res.json({
      success: true,
      data: result.roles,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({ success: false, message: '获取角色列表失败', error: error.message });
  }
});

router.post('/', validate(roleSchema), async (req, res) => {
  try {
    const existing = await AdminRole.getByCode(req.body.code);
    if (existing) {
      return res.status(409).json({ success: false, message: '角色编码已存在' });
    }

    const id = await AdminRole.create({
      ...req.body,
      is_system: 0
    });

    res.status(201).json({
      success: true,
      message: '角色创建成功',
      data: { id }
    });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.status(500).json({ success: false, message: '创建角色失败', error: error.message });
  }
});

router.put('/:id', validate(roleUpdateSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的角色ID' });
    }

    const existing = await AdminRole.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }

    await AdminRole.update(id, req.body);
    res.json({ success: true, message: '角色更新成功' });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.status(500).json({ success: false, message: '更新角色失败', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的角色ID' });
    }

    const existing = await AdminRole.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }

    if (existing.is_system) {
      return res.status(400).json({ success: false, message: '系统内置角色不允许删除' });
    }

    const bindCount = await AdminRole.countUsersByRole(existing.code);
    if (bindCount > 0) {
      return res.status(400).json({ success: false, message: '该角色下仍有管理员账号，无法删除' });
    }

    await AdminRole.delete(id);
    res.json({ success: true, message: '角色删除成功' });
  } catch (error) {
    console.error('删除角色失败:', error);
    res.status(500).json({ success: false, message: '删除角色失败', error: error.message });
  }
});

module.exports = router;

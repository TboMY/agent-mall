const express = require('express');
const Joi = require('joi');

const MallUser = require('../models/MallUser');
const { validate } = require('../middleware/validation');
const { signUserToken, authenticateCustomer } = require('../middleware/customerAuth');

const router = express.Router();

const registerSchema = Joi.object({
  username: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': '用户名不能为空',
    'string.min': '用户名至少需要2个字符',
    'string.max': '用户名不能超过50个字符',
    'any.required': '用户名不能为空'
  }),
  nickname: Joi.string().trim().max(50).allow('', null).messages({
    'string.max': '昵称不能超过50个字符'
  }),
  phone: Joi.string().trim().pattern(/^1\d{10}$/).allow('', null).messages({
    'string.pattern.base': '请输入正确的11位手机号'
  }),
  email: Joi.string().email().max(100).allow('', null).messages({
    'string.email': '请输入正确的邮箱地址',
    'string.max': '邮箱不能超过100个字符'
  }),
  password: Joi.string().min(6).max(50).required().messages({
    'string.empty': '密码不能为空',
    'string.min': '密码至少需要6个字符',
    'string.max': '密码不能超过50个字符',
    'any.required': '密码不能为空'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': '两次输入的密码不一致',
    'string.empty': '请再次输入密码',
    'any.required': '请再次输入密码'
  }),
  gender: Joi.number().integer().valid(0, 1, 2).default(0)
});

const profileSchema = Joi.object({
  nickname: Joi.string().trim().max(50).allow('', null).messages({
    'string.max': '昵称不能超过50个字符'
  }),
  email: Joi.string().email().max(100).allow('', null).messages({
    'string.email': '请输入正确的邮箱地址',
    'string.max': '邮箱不能超过100个字符'
  }),
  gender: Joi.number().integer().valid(0, 1, 2).required().messages({
    'any.only': '性别参数不正确',
    'any.required': '性别不能为空'
  })
});

const changePhoneSchema = Joi.object({
  phone: Joi.string().trim().pattern(/^1\d{10}$/).required().messages({
    'string.empty': '手机号不能为空',
    'string.pattern.base': '请输入正确的11位手机号',
    'any.required': '手机号不能为空'
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).max(50).required().messages({
    'string.empty': '当前密码不能为空',
    'string.min': '当前密码至少需要6个字符',
    'string.max': '当前密码不能超过50个字符',
    'any.required': '当前密码不能为空'
  }),
  newPassword: Joi.string().min(6).max(50).required().messages({
    'string.empty': '新密码不能为空',
    'string.min': '新密码至少需要6个字符',
    'string.max': '新密码不能超过50个字符',
    'any.required': '新密码不能为空'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': '两次输入的新密码不一致',
    'string.empty': '请再次输入新密码',
    'any.required': '请再次输入新密码'
  })
});

/**
 * 前台用户注册。
 */
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    delete req.body.confirmPassword;
    const { username, phone, email } = req.body;

    if (await MallUser.getByUsername(username)) {
      return res.status(409).json({ success: false, message: '用户名已存在' });
    }

    if (phone && await MallUser.getByPhone(phone)) {
      return res.status(409).json({ success: false, message: '手机号已存在' });
    }

    if (email && await MallUser.getByEmail(email)) {
      return res.status(409).json({ success: false, message: '邮箱已存在' });
    }

    const userId = await MallUser.create(req.body);
    const user = await MallUser.getById(userId);
    const token = signUserToken(user);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: MallUser.sanitize(user)
      }
    });
  } catch (error) {
    console.error('前台用户注册失败:', error);
    res.status(500).json({ success: false, message: '注册失败', error: error.message });
  }
});

/**
 * 前台用户登录，当前支持用户名登录。
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名和密码' });
    }

    const user = await MallUser.getByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    if (Number(user.status) !== 1) {
      return res.status(403).json({ success: false, message: '账号已被禁用' });
    }

    const matched = await MallUser.verifyPassword(password, user.password);
    if (!matched) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    await MallUser.markLoginSuccess(user.id);
    const token = signUserToken(user);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: MallUser.sanitize(user)
      }
    });
  } catch (error) {
    console.error('前台用户登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败', error: error.message });
  }
});

/**
 * 获取当前前台用户信息。
 */
router.get('/me', authenticateCustomer, async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.customerAuth.user
    }
  });
});

router.patch('/me/profile', authenticateCustomer, validate(profileSchema), async (req, res) => {
  try {
    const userId = req.customerAuth.user.id;
    const email = req.body.email?.trim() || null;

    if (email) {
      const existing = await MallUser.getByEmail(email);
      if (existing && Number(existing.id) !== Number(userId)) {
        return res.status(409).json({ success: false, message: '邮箱已存在' });
      }
    }

    const user = await MallUser.updateProfile(userId, {
      nickname: req.body.nickname,
      email,
      gender: req.body.gender
    });

    res.json({
      success: true,
      message: '账户信息已更新',
      data: {
        user: MallUser.sanitize(user)
      }
    });
  } catch (error) {
    console.error('更新前台用户资料失败:', error);
    res.status(500).json({ success: false, message: '更新账户信息失败' });
  }
});

router.patch('/me/phone', authenticateCustomer, validate(changePhoneSchema), async (req, res) => {
  try {
    const userId = req.customerAuth.user.id;
    const phone = req.body.phone.trim();
    const existing = await MallUser.getByPhone(phone);
    if (existing && Number(existing.id) !== Number(userId)) {
      return res.status(409).json({ success: false, message: '手机号已存在' });
    }

    const user = await MallUser.updatePhone(userId, phone);
    res.json({
      success: true,
      message: '手机号已更新',
      data: {
        user: MallUser.sanitize(user)
      }
    });
  } catch (error) {
    console.error('更新前台用户手机号失败:', error);
    res.status(500).json({ success: false, message: '更新手机号失败' });
  }
});

router.patch('/me/password', authenticateCustomer, validate(changePasswordSchema), async (req, res) => {
  try {
    const userId = req.customerAuth.user.id;
    const fullUser = await MallUser.getById(userId);
    const matched = await MallUser.verifyPassword(req.body.currentPassword, fullUser.password);
    if (!matched) {
      return res.status(400).json({ success: false, message: '当前密码错误' });
    }

    await MallUser.updatePassword(userId, req.body.newPassword);
    res.json({
      success: true,
      message: '登录密码已更新'
    });
  } catch (error) {
    console.error('更新前台用户密码失败:', error);
    res.status(500).json({ success: false, message: '更新密码失败' });
  }
});

module.exports = router;

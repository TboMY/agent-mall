const express = require('express');

const MallUser = require('../models/MallUser');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');
const { query } = require('../config/database');

const router = express.Router();

router.use(requirePermission(PERMISSIONS.MALL_USERS_VIEW));

/**
 * 商城用户列表，供后台查看前台会员账号。
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 100));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.search) {
      conditions.push('(username LIKE ? OR nickname LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const keyword = `%${req.query.search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (req.query.status !== undefined && req.query.status !== '') {
      conditions.push('status = ?');
      params.push(Number(req.query.status));
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const listSql = `
      SELECT id, username, nickname, phone, email, avatar, gender, status, last_login_at, created_at, updated_at
      FROM users
      ${whereSql}
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) AS total FROM users ${whereSql}`;

    const rows = await query(listSql, params);
    const [{ total }] = await query(countSql, params);

    res.json({
      success: true,
      data: rows.map(item => MallUser.sanitize(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取商城用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商城用户列表失败',
      error: error.message
    });
  }
});

module.exports = router;

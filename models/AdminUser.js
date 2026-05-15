const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const AdminRole = require('./AdminRole');

class AdminUser {
  /**
   * 将数据库用户对象裁剪成可安全返回给前端的结构。
   */
  static sanitize(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      role_label: user.role_name || user.role,
      status: user.status,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      permissions: AdminRole.parsePermissions(user.role_permissions || user.permissions)
    };
  }

  /**
   * 根据用户名获取管理员账号，包含密码哈希，供登录校验使用。
   */
  static async getByUsername(username) {
    const sql = `
      SELECT
        u.*,
        r.name AS role_name,
        r.permissions AS role_permissions
      FROM admin_users u
      LEFT JOIN admin_roles r ON r.code = u.role
      WHERE u.username = ?
      LIMIT 1
    `;
    const [user] = await query(sql, [username]);
    return user || null;
  }

  /**
   * 根据 ID 获取管理员账号。
   */
  static async getById(id) {
    const sql = `
      SELECT
        u.*,
        r.name AS role_name,
        r.permissions AS role_permissions
      FROM admin_users u
      LEFT JOIN admin_roles r ON r.code = u.role
      WHERE u.id = ?
      LIMIT 1
    `;
    const [user] = await query(sql, [id]);
    return user || null;
  }

  /**
   * 校验管理员密码是否正确。
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * 获取管理员列表，支持用户名、角色、状态筛选。
   */
  static async list(options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (options.search) {
      conditions.push('(username LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const keyword = `%${options.search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (options.role) {
      conditions.push('role = ?');
      params.push(options.role);
    }

    if (options.status !== null && options.status !== undefined && options.status !== '') {
      conditions.push('status = ?');
      params.push(Number(options.status));
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const listSql = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        r.name AS role_name,
        r.permissions AS role_permissions
      FROM admin_users u
      LEFT JOIN admin_roles r ON r.code = u.role
      ${whereSql}
      ORDER BY u.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) AS total FROM admin_users u ${whereSql}`;

    const rows = await query(listSql, params);
    const [{ total }] = await query(countSql, params);

    return {
      users: rows.map((item) => this.sanitize(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 创建管理员账号。
   */
  static async create(data) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const sql = `
      INSERT INTO admin_users (username, password, email, phone, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.username,
      passwordHash,
      data.email || null,
      data.phone || null,
      data.role || 'operator',
      data.status === undefined ? 1 : Number(data.status)
    ]);

    return result.insertId;
  }

  /**
   * 更新管理员基础信息，不包含密码。
   */
  static async update(id, data) {
    const sql = `
      UPDATE admin_users
      SET username = ?, email = ?, phone = ?, role = ?, status = ?
      WHERE id = ?
    `;
    const result = await query(sql, [
      data.username,
      data.email || null,
      data.phone || null,
      data.role || 'operator',
      Number(data.status),
      id
    ]);

    return result.affectedRows > 0;
  }

  /**
   * 更新管理员密码。
   */
  static async updatePassword(id, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const sql = 'UPDATE admin_users SET password = ? WHERE id = ?';
    const result = await query(sql, [passwordHash, id]);
    return result.affectedRows > 0;
  }

  /**
   * 更新管理员启用状态。
   */
  static async updateStatus(id, status) {
    const sql = 'UPDATE admin_users SET status = ? WHERE id = ?';
    const result = await query(sql, [Number(status), id]);
    return result.affectedRows > 0;
  }

  /**
   * 登录成功后更新最后登录时间。
   */
  static async markLoginSuccess(id) {
    const sql = 'UPDATE admin_users SET last_login_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  }

  /**
   * 删除管理员账号。
   */
  static async delete(id) {
    const sql = 'DELETE FROM admin_users WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  /**
   * 统计激活状态下的超级管理员数量。
   */
  static async countActiveSuperAdmins(excludeId = null) {
    const params = ['super_admin', 1];
    let sql = 'SELECT COUNT(*) AS total FROM admin_users WHERE role = ? AND status = ?';

    if (excludeId) {
      sql += ' AND id <> ?';
      params.push(excludeId);
    }

    const [{ total }] = await query(sql, params);
    return total;
  }
}

module.exports = AdminUser;

const { query } = require('../config/database');
const { PERMISSIONS, PERMISSION_LABELS } = require('../config/permissions');

class AdminRole {
  /**
   * 解析角色权限 JSON。
   */
  static parsePermissions(value) {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  }

  /**
   * 将数据库角色对象转换成前端使用结构。
   */
  static sanitize(role) {
    if (!role) {
      return null;
    }

    const permissions = this.parsePermissions(role.permissions);
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      status: Number(role.status),
      is_system: Number(role.is_system),
      permissions,
      permission_labels: permissions.map(code => ({
        code,
        label: PERMISSION_LABELS[code] || code
      })),
      created_at: role.created_at,
      updated_at: role.updated_at
    };
  }

  /**
   * 查询角色列表。
   */
  static async list(options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (options.search) {
      conditions.push('(code LIKE ? OR name LIKE ? OR description LIKE ?)');
      const keyword = `%${options.search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (options.status !== undefined && options.status !== null && options.status !== '') {
      conditions.push('status = ?');
      params.push(Number(options.status));
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const listSql = `
      SELECT *
      FROM admin_roles
      ${whereSql}
      ORDER BY is_system DESC, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) AS total FROM admin_roles ${whereSql}`;

    const rows = await query(listSql, params);
    const [{ total }] = await query(countSql, params);

    return {
      roles: rows.map(role => this.sanitize(role)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取所有启用角色，常用于下拉框。
   */
  static async getActiveRoles() {
    const sql = 'SELECT * FROM admin_roles WHERE status = 1 ORDER BY is_system DESC, id ASC';
    const rows = await query(sql, []);
    return rows.map(role => this.sanitize(role));
  }

  /**
   * 根据 ID 获取角色。
   */
  static async getById(id) {
    const sql = 'SELECT * FROM admin_roles WHERE id = ? LIMIT 1';
    const [role] = await query(sql, [id]);
    return role ? this.sanitize(role) : null;
  }

  /**
   * 根据编码获取角色。
   */
  static async getByCode(code) {
    const sql = 'SELECT * FROM admin_roles WHERE code = ? LIMIT 1';
    const [role] = await query(sql, [code]);
    return role ? this.sanitize(role) : null;
  }

  /**
   * 创建角色。
   */
  static async create(data) {
    const sql = `
      INSERT INTO admin_roles (code, name, description, status, is_system, permissions)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.code,
      data.name,
      data.description || null,
      Number(data.status ?? 1),
      Number(data.is_system ?? 0),
      JSON.stringify(data.permissions || [])
    ]);
    return result.insertId;
  }

  /**
   * 更新角色。
   */
  static async update(id, data) {
    const sql = `
      UPDATE admin_roles
      SET name = ?, description = ?, status = ?, permissions = ?
      WHERE id = ?
    `;
    const result = await query(sql, [
      data.name,
      data.description || null,
      Number(data.status ?? 1),
      JSON.stringify(data.permissions || []),
      id
    ]);
    return result.affectedRows > 0;
  }

  /**
   * 删除角色。
   */
  static async delete(id) {
    const sql = 'DELETE FROM admin_roles WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  /**
   * 统计使用某角色的管理员数量。
   */
  static async countUsersByRole(code) {
    const sql = 'SELECT COUNT(*) AS total FROM admin_users WHERE role = ?';
    const [{ total }] = await query(sql, [code]);
    return total;
  }

  /**
   * 获取权限目录。
   */
  static getPermissionCatalog() {
    return Object.values(PERMISSIONS).map(code => ({
      code,
      label: PERMISSION_LABELS[code] || code
    }));
  }
}

module.exports = AdminRole;

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

class MallUser {
  /**
   * 将前台用户对象裁剪为可返回给客户端的安全结构。
   */
  static sanitize(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      gender: user.gender,
      status: user.status,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }

  /**
   * 根据用户名查找前台用户。
   */
  static async getByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ? LIMIT 1';
    const [user] = await query(sql, [username]);
    return user || null;
  }

  /**
   * 根据手机号查找前台用户。
   */
  static async getByPhone(phone) {
    const sql = 'SELECT * FROM users WHERE phone = ? LIMIT 1';
    const [user] = await query(sql, [phone]);
    return user || null;
  }

  /**
   * 根据邮箱查找前台用户。
   */
  static async getByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ? LIMIT 1';
    const [user] = await query(sql, [email]);
    return user || null;
  }

  /**
   * 根据 ID 获取前台用户。
   */
  static async getById(id) {
    const sql = 'SELECT * FROM users WHERE id = ? LIMIT 1';
    const [user] = await query(sql, [id]);
    return user || null;
  }

  /**
   * 创建前台用户。
   */
  static async create(data) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const sql = `
      INSERT INTO users (username, nickname, phone, email, password, avatar, gender, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      data.username,
      data.nickname || data.username,
      data.phone || null,
      data.email || null,
      passwordHash,
      data.avatar || null,
      Number(data.gender || 0),
      data.status === undefined ? 1 : Number(data.status)
    ]);

    return result.insertId;
  }

  /**
   * 校验用户密码。
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * 登录成功后更新最后登录时间。
   */
  static async markLoginSuccess(id) {
    const sql = 'UPDATE users SET last_login_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  }

  /**
   * 更新前台用户基础信息。
   */
  static async updateProfile(id, data) {
    const sql = `
      UPDATE users
      SET nickname = ?,
          email = ?,
          gender = ?,
          updated_at = NOW()
      WHERE id = ?
    `;
    await query(sql, [
      data.nickname || null,
      data.email || null,
      Number(data.gender ?? 2),
      id
    ]);
    return this.getById(id);
  }

  /**
   * 更新前台用户手机号。
   */
  static async updatePhone(id, phone) {
    await query(
      `UPDATE users
       SET phone = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [phone || null, id]
    );
    return this.getById(id);
  }

  /**
   * 更新前台用户登录密码。
   */
  static async updatePassword(id, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `UPDATE users
       SET password = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, id]
    );
    return true;
  }
}

module.exports = MallUser;

const { query } = require('../config/database');

class UserAddress {
  /**
   * 获取当前用户的全部收货地址。
   */
  static async listByUserId(userId) {
    return await query(
      `SELECT *
       FROM user_addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, id DESC`,
      [userId]
    );
  }

  /**
   * 获取单个地址详情。
   */
  static async getById(id, userId) {
    const [row] = await query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    return row || null;
  }

  /**
   * 创建地址，必要时自动处理默认地址。
   */
  static async create(userId, data) {
    const current = await this.listByUserId(userId);
    const shouldDefault = Number(data.is_default) === 1 || current.length === 0;

    if (shouldDefault) {
      await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const result = await query(
      `INSERT INTO user_addresses (
        user_id, recipient_name, recipient_phone, province, city, district,
        detail_address, postal_code, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        data.recipient_name,
        data.recipient_phone,
        data.province,
        data.city,
        data.district || '',
        data.detail_address,
        data.postal_code || '',
        shouldDefault ? 1 : 0
      ]
    );

    return result.insertId;
  }

  /**
   * 更新地址信息。
   */
  static async update(id, userId, data) {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return false;
    }

    if (Number(data.is_default) === 1) {
      await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const result = await query(
      `UPDATE user_addresses
       SET recipient_name = ?, recipient_phone = ?, province = ?, city = ?, district = ?,
           detail_address = ?, postal_code = ?, is_default = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        data.recipient_name,
        data.recipient_phone,
        data.province,
        data.city,
        data.district || '',
        data.detail_address,
        data.postal_code || '',
        Number(data.is_default) === 1 ? 1 : 0,
        id,
        userId
      ]
    );

    return result.affectedRows > 0;
  }

  /**
   * 设置默认地址。
   */
  static async setDefault(id, userId) {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return false;
    }

    await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    const result = await query(
      'UPDATE user_addresses SET is_default = 1, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 删除地址，并在必要时补默认地址。
   */
  static async delete(id, userId) {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return false;
    }

    const result = await query(
      'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!result.affectedRows) {
      return false;
    }

    if (Number(existing.is_default) === 1) {
      const [next] = await query(
        'SELECT id FROM user_addresses WHERE user_id = ? ORDER BY id ASC LIMIT 1',
        [userId]
      );
      if (next) {
        await query(
          'UPDATE user_addresses SET is_default = 1, updated_at = NOW() WHERE id = ?',
          [next.id]
        );
      }
    }

    return true;
  }
}

module.exports = UserAddress;

const { query, transaction } = require('../config/database');

class ShoppingCart {
  static parseJsonField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  // 获取或创建购物车
  static async ensureCart(userId, connection = null) {
    const runner = connection || { query: async (sql, params) => [await query(sql, params)] };
    const [rows] = await runner.query(
      'SELECT * FROM shopping_carts WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (rows[0]) {
      return rows[0];
    }

    const [result] = await runner.query(
      'INSERT INTO shopping_carts (user_id, created_at, updated_at) VALUES (?, NOW(), NOW())',
      [userId]
    );

    return {
      id: result.insertId,
      user_id: userId
    };
  }

  // 获取当前用户购物车列表
  static async getItemsByUserId(userId, connection = null) {
    const cart = await this.ensureCart(userId, connection);
    const sql = `
      SELECT
        ci.id,
        ci.cart_id,
        ci.product_id,
        ci.sku_id,
        ci.quantity,
        ci.selected,
        ci.created_at,
        ci.updated_at,
        p.name AS product_name,
        p.image AS product_image,
        p.status AS product_status,
        ps.sku_code,
        ps.sku_name,
        ps.price,
        ps.original_price,
        ps.stock AS sku_stock,
        ps.image AS sku_image,
        ps.status AS sku_status,
        ps.spec_summary
      FROM cart_items ci
      INNER JOIN products p ON p.id = ci.product_id
      INNER JOIN product_skus ps ON ps.id = ci.sku_id
      WHERE ci.cart_id = ?
      ORDER BY ci.updated_at DESC, ci.id DESC
    `;
    const rows = connection
      ? (await connection.query(sql, [cart.id]))[0]
      : await query(sql, [cart.id]);
    return rows.map((row) => ({
      ...row,
      spec_summary: this.parseJsonField(row.spec_summary)
    }));
  }

  // 添加 SKU 到购物车
  static async addItem(userId, payload) {
    return await transaction(async (connection) => {
      const cart = await this.ensureCart(userId, connection);
      const quantity = Math.max(1, Number(payload.quantity || 1));

      const [skuRows] = await connection.query(
        `SELECT ps.*, p.name AS product_name, p.status AS product_status
         FROM product_skus ps
         INNER JOIN products p ON p.id = ps.product_id
         WHERE ps.id = ? LIMIT 1`,
        [payload.sku_id]
      );
      const sku = skuRows[0];

      if (!sku || Number(sku.status) !== 1 || Number(sku.product_status) !== 1) {
        throw new Error('SKU 不存在或已下架');
      }

      const [existingRows] = await connection.query(
        'SELECT * FROM cart_items WHERE cart_id = ? AND sku_id = ? LIMIT 1',
        [cart.id, payload.sku_id]
      );
      const existing = existingRows[0];

      if (existing) {
        const nextQuantity = Number(existing.quantity) + quantity;
        if (nextQuantity > Number(sku.stock)) {
          throw new Error('库存不足，无法加入购物车');
        }
        await connection.query(
          'UPDATE cart_items SET quantity = ?, selected = 1, updated_at = NOW() WHERE id = ?',
          [nextQuantity, existing.id]
        );
      } else {
        if (quantity > Number(sku.stock)) {
          throw new Error('库存不足，无法加入购物车');
        }
        await connection.query(
          `INSERT INTO cart_items
           (cart_id, product_id, sku_id, quantity, selected, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [cart.id, sku.product_id, sku.id, quantity, payload.selected == null ? 1 : Number(payload.selected)]
        );
      }

      return await this.getItemsByUserId(userId, connection);
    });
  }

  // 更新购物车项
  static async updateItem(userId, itemId, payload) {
    return await transaction(async (connection) => {
      const cart = await this.ensureCart(userId, connection);
      const [rows] = await connection.query(
        `SELECT ci.*, ps.stock AS sku_stock, ps.status AS sku_status
         FROM cart_items ci
         INNER JOIN product_skus ps ON ps.id = ci.sku_id
         WHERE ci.id = ? AND ci.cart_id = ?
         LIMIT 1`,
        [itemId, cart.id]
      );
      const item = rows[0];
      if (!item) {
        throw new Error('购物车项不存在');
      }

      const nextQuantity = payload.quantity == null ? Number(item.quantity) : Math.max(1, Number(payload.quantity));
      const nextSelected = payload.selected == null ? Number(item.selected) : Number(payload.selected);

      if (nextQuantity > Number(item.sku_stock) || Number(item.sku_status) !== 1) {
        throw new Error('库存不足或 SKU 已下架');
      }

      await connection.query(
        'UPDATE cart_items SET quantity = ?, selected = ?, updated_at = NOW() WHERE id = ?',
        [nextQuantity, nextSelected ? 1 : 0, itemId]
      );

      return await this.getItemsByUserId(userId, connection);
    });
  }

  // 删除购物车项
  static async removeItems(userId, itemIds) {
    return await transaction(async (connection) => {
      const cart = await this.ensureCart(userId, connection);
      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      const normalizedIds = ids.map((id) => Number(id)).filter(Boolean);

      if (!normalizedIds.length) {
        return await this.getItemsByUserId(userId, connection);
      }

      const placeholders = normalizedIds.map(() => '?').join(',');
      await connection.query(
        `DELETE FROM cart_items WHERE cart_id = ? AND id IN (${placeholders})`,
        [cart.id, ...normalizedIds]
      );
      return await this.getItemsByUserId(userId, connection);
    });
  }

  // 获取待结算购物车项
  static async getCheckoutItems(connection, userId, itemIds) {
    const cart = await this.ensureCart(userId, connection);
    const ids = (Array.isArray(itemIds) ? itemIds : []).map((id) => Number(id)).filter(Boolean);
    if (!ids.length) {
      throw new Error('请选择要结算的购物车项');
    }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await connection.query(
      `SELECT
         ci.*,
         p.name AS product_name,
         p.image AS product_image,
         p.source_platform,
         p.source_url,
         ps.sku_code,
         ps.sku_name,
         ps.price,
         ps.original_price,
         ps.stock AS sku_stock,
         ps.status AS sku_status,
         ps.spec_summary
       FROM cart_items ci
       INNER JOIN products p ON p.id = ci.product_id
       INNER JOIN product_skus ps ON ps.id = ci.sku_id
       WHERE ci.cart_id = ? AND ci.id IN (${placeholders})`,
      [cart.id, ...ids]
    );

    return rows.map((row) => ({
      ...row,
      spec_summary: this.parseJsonField(row.spec_summary)
    }));
  }
}

module.exports = ShoppingCart;

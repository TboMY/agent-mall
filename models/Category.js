const { query, transaction } = require('../config/database');

class Category {
  // 获取所有分类
  static async getAll() {
    const sql = `
      SELECT * FROM categories
      WHERE status = 1
      ORDER BY parent_id ASC, sort_order ASC, id ASC
    `;
    return await query(sql);
  }

  // 获取分类树形结构
  static async getTree() {
    const categories = await this.getAll();
    return this.buildTree(categories);
  }

  // 构建树形结构
  static buildTree(categories, parentId = 0) {
    return categories
      .filter((category) => category.parent_id === parentId)
      .map((category) => {
        const children = this.buildTree(categories, category.id);
        return children.length > 0
          ? { ...category, children }
          : { ...category, children: [] };
      });
  }

  // 根据ID获取分类
  static async getById(id) {
    const sql = 'SELECT * FROM categories WHERE id = ?';
    const [category] = await query(sql, [id]);
    return category || null;
  }

  // 获取同级分类最大排序值
  static async getMaxSortOrder(parentId = 0, connection = null) {
    const runner = connection || { query: async (sql, params) => [await query(sql, params)] };
    const [rows] = await runner.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM categories WHERE parent_id = ?',
      [parentId]
    );
    return Number(rows[0]?.max_sort_order || 0);
  }

  // 解析父分类并计算层级
  static async resolveParent(parentId, currentId = null, connection = null) {
    const normalizedParentId = Number(parentId || 0);
    if (normalizedParentId === 0) {
      return { parentId: 0, level: 1, parent: null };
    }

    if (currentId && normalizedParentId === Number(currentId)) {
      throw new Error('父分类不能选择自己');
    }

    const runner = connection || { query: async (sql, params) => [await query(sql, params)] };
    const [rows] = await runner.query('SELECT * FROM categories WHERE id = ?', [normalizedParentId]);
    const parent = rows[0];

    if (!parent) {
      throw new Error('父分类不存在');
    }

    if (parent.level >= 2) {
      throw new Error('当前仅支持两级分类，二级分类不能再作为父分类');
    }

    return {
      parentId: normalizedParentId,
      level: Number(parent.level) + 1,
      parent
    };
  }

  // 检查某个分类是否存在子分类
  static async hasChildren(id, connection = null) {
    const runner = connection || { query: async (sql, params) => [await query(sql, params)] };
    const [rows] = await runner.query('SELECT COUNT(*) AS count FROM categories WHERE parent_id = ?', [id]);
    return Number(rows[0]?.count || 0) > 0;
  }

  // 创建分类
  static async create(categoryData) {
    return await transaction(async (connection) => {
      const {
        name,
        icon = '',
        description = '',
        status = 1
      } = categoryData;

      const parentMeta = await this.resolveParent(categoryData.parent_id, null, connection);
      const maxSortOrder = await this.getMaxSortOrder(parentMeta.parentId, connection);
      const sortOrder = maxSortOrder + 10;

      const [result] = await connection.query(
        `INSERT INTO categories (name, parent_id, level, sort_order, icon, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, parentMeta.parentId, parentMeta.level, sortOrder, icon, description, status]
      );

      return result.insertId;
    });
  }

  // 更新分类
  static async update(id, categoryData) {
    return await transaction(async (connection) => {
      const [rows] = await connection.query('SELECT * FROM categories WHERE id = ?', [id]);
      const existing = rows[0];

      if (!existing) {
        throw new Error('分类不存在');
      }

      const nextParentId = categoryData.parent_id != null
        ? Number(categoryData.parent_id)
        : Number(existing.parent_id);

      const parentMeta = await this.resolveParent(nextParentId, id, connection);

      if (existing.parent_id !== parentMeta.parentId && parentMeta.parentId !== 0) {
        const hasChildren = await this.hasChildren(id, connection);
        if (hasChildren) {
          throw new Error('当前分类下还有子分类，不能直接调整为二级分类');
        }
      }

      const fields = [];
      const params = [];

      const nextName = categoryData.name ?? existing.name;
      const nextIcon = categoryData.icon ?? existing.icon;
      const nextDescription = categoryData.description ?? existing.description;
      const nextStatus = categoryData.status ?? existing.status;

      fields.push('name = ?');
      params.push(nextName);
      fields.push('parent_id = ?');
      params.push(parentMeta.parentId);
      fields.push('level = ?');
      params.push(parentMeta.level);
      fields.push('icon = ?');
      params.push(nextIcon);
      fields.push('description = ?');
      params.push(nextDescription);
      fields.push('status = ?');
      params.push(nextStatus);

      if (existing.parent_id !== parentMeta.parentId) {
        const maxSortOrder = await this.getMaxSortOrder(parentMeta.parentId, connection);
        fields.push('sort_order = ?');
        params.push(maxSortOrder + 10);
      }

      fields.push('updated_at = NOW()');
      params.push(id);

      const [result] = await connection.query(
        `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      return result.affectedRows > 0;
    });
  }

  // 同级拖拽排序
  static async reorderSiblings(parentId, orderedIds) {
    return await transaction(async (connection) => {
      const normalizedParentId = Number(parentId || 0);
      const ids = orderedIds.map((id) => Number(id));
      if (!ids.length) {
        return false;
      }

      const [rows] = await connection.query(
        'SELECT id FROM categories WHERE parent_id = ? ORDER BY sort_order ASC, id ASC',
        [normalizedParentId]
      );
      const siblingIds = rows.map((row) => Number(row.id));

      if (siblingIds.length !== ids.length) {
        throw new Error('排序数据不完整，请刷新后重试');
      }

      const sameMembers = siblingIds.every((id) => ids.includes(id));
      if (!sameMembers) {
        throw new Error('只能对同级分类进行排序');
      }

      for (let index = 0; index < ids.length; index += 1) {
        await connection.query(
          'UPDATE categories SET sort_order = ?, updated_at = NOW() WHERE id = ?',
          [(index + 1) * 10, ids[index]]
        );
      }

      return true;
    });
  }

  // 删除分类
  static async delete(id) {
    const childrenSql = 'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?';
    const [childrenResult] = await query(childrenSql, [id]);

    if (childrenResult.count > 0) {
      throw new Error('该分类下还有子分类，无法删除');
    }

    const productsSql = 'SELECT COUNT(*) as count FROM products WHERE category_id = ?';
    const [productsResult] = await query(productsSql, [id]);

    if (productsResult.count > 0) {
      throw new Error('该分类下还有商品，无法删除');
    }

    const templatesSql = 'SELECT COUNT(*) as count FROM product_types WHERE category_id = ?';
    const [templatesResult] = await query(templatesSql, [id]);
    if (templatesResult.count > 0) {
      throw new Error('该分类下还有规格模板，无法删除');
    }

    const sql = 'DELETE FROM categories WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Category;

const { query } = require('../config/database');

class Category {
  // 获取所有分类
  static async getAll() {
    const sql = `
      SELECT * FROM categories 
      WHERE status = 1 
      ORDER BY level ASC, sort_order ASC, id ASC
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
    const tree = [];
    categories.forEach(category => {
      if (category.parent_id === parentId) {
        const children = this.buildTree(categories, category.id);
        if (children.length > 0) {
          category.children = children;
        }
        tree.push(category);
      }
    });
    return tree;
  }

  // 根据ID获取分类
  static async getById(id) {
    const sql = 'SELECT * FROM categories WHERE id = ?';
    const [category] = await query(sql, [id]);
    return category;
  }

  // 创建分类
  static async create(categoryData) {
    const { name, parent_id = 0, level = 1, sort_order = 0, icon, description, status = 1 } = categoryData;
    
    const sql = `
      INSERT INTO categories (name, parent_id, level, sort_order, icon, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [name, parent_id, level, sort_order, icon, description, status]);
    return result.insertId;
  }

  // 更新分类
  static async update(id, categoryData) {
    const fields = [];
    const params = [];

    Object.keys(categoryData).forEach(key => {
      if (categoryData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(categoryData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const sql = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params);
    return result.affectedRows > 0;
  }

  // 删除分类
  static async delete(id) {
    // 检查是否有子分类
    const childrenSql = 'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?';
    const [childrenResult] = await query(childrenSql, [id]);
    
    if (childrenResult.count > 0) {
      throw new Error('该分类下还有子分类，无法删除');
    }

    // 检查是否有商品使用该分类
    const productsSql = 'SELECT COUNT(*) as count FROM products WHERE category_id = ?';
    const [productsResult] = await query(productsSql, [id]);
    
    if (productsResult.count > 0) {
      throw new Error('该分类下还有商品，无法删除');
    }

    const sql = 'DELETE FROM categories WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Category;

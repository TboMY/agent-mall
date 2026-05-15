const { query } = require('../config/database');

class ProductType {
  // 获取所有规格模板
  static async getAll(options = {}) {
    const { page = 1, limit = 20, search = '', status = null, category_id = null } = options;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    let sql = `
      SELECT 
        pt.*,
        c.name as category_name,
        COUNT(pa.id) as attribute_count
      FROM product_types pt
      LEFT JOIN categories c ON pt.category_id = c.id
      LEFT JOIN product_attributes pa ON pt.id = pa.product_type_id AND pa.status = 1
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (pt.name LIKE ? OR pt.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status !== null) {
      sql += ` AND pt.status = ?`;
      params.push(status);
    }

    if (category_id) {
      sql += ` AND pt.category_id = ?`;
      params.push(category_id);
    }

    sql += ` GROUP BY pt.id ORDER BY pt.sort_order ASC, pt.created_at DESC`;

    // 分页
    const offset = (pageNum - 1) * limitNum;
    sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const types = await query(sql, params);
    return types;
  }

  // 根据ID获取规格模板
  static async getById(id) {
    const sql = `
      SELECT
        pt.*,
        c.name as category_name
      FROM product_types pt
      LEFT JOIN categories c ON pt.category_id = c.id
      WHERE pt.id = ?
    `;
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // 创建规格模板
  static async create(data) {
    const {
      category_id,
      name,
      description = '',
      icon = '',
      sort_order = 0,
      status = 1
    } = data;

    const sql = `
      INSERT INTO product_types (category_id, name, description, icon, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [category_id, name, description, icon, sort_order, status]);
    return result.insertId;
  }

  // 更新规格模板
  static async update(id, data) {
    const {
      category_id,
      name,
      description,
      icon,
      sort_order,
      status
    } = data;

    const sql = `
      UPDATE product_types 
      SET category_id = ?, name = ?, description = ?, icon = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await query(sql, [category_id, name, description, icon, sort_order, status, id]);
    return result.affectedRows > 0;
  }

  // 删除规格模板
  static async delete(id) {
    const productsSql = 'SELECT COUNT(*) as count FROM products WHERE product_type_id = ?';
    const [productsResult] = await query(productsSql, [id]);

    if (productsResult.count > 0) {
      throw new Error('该规格模板下还有商品，无法删除');
    }

    const sql = `DELETE FROM product_types WHERE id = ?`;
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 获取规格模板的规格项列表
  static async getAttributes(typeId) {
    const sql = `
      SELECT 
        pa.*,
        GROUP_CONCAT(
          CONCAT(pav.id, ':', pav.value, ':', IFNULL(pav.label, ''), ':', IFNULL(pav.color, ''), ':', IFNULL(pav.image, ''))
          ORDER BY pav.sort_order ASC
          SEPARATOR '|'
        ) as \`values\`
      FROM product_attributes pa
      LEFT JOIN product_attribute_values pav ON pa.id = pav.attribute_id AND pav.status = 1
      WHERE pa.product_type_id = ? AND pa.status = 1
      GROUP BY pa.id
      ORDER BY pa.sort_order ASC
    `;
    const attributes = await query(sql, [typeId]);
    
    // 处理属性值
    return attributes.map(attr => ({
      ...attr,
      values: attr.values ? attr.values.split('|').map(valueStr => {
        const [id, value, label, color, image] = valueStr.split(':');
        return {
          id: parseInt(id),
          value,
          label: label || value,
          color: color || null,
          image: image || null
        };
      }) : []
    }));
  }

  // 获取启用状态的规格模板列表（用于商品表单选择）
  static async getActiveList(categoryId = null) {
    const sql = `
      SELECT id, name, icon, category_id
      FROM product_types 
      WHERE status = 1
      ${categoryId ? 'AND category_id = ?' : ''}
      ORDER BY sort_order ASC, name ASC
    `;
    return await query(sql, categoryId ? [categoryId] : []);
  }
}

module.exports = ProductType;

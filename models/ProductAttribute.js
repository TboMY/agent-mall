const { query } = require('../config/database');

class ProductAttribute {
  // 获取属性列表
  static async getAll(options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      product_type_id = null, 
      status = null 
    } = options;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    let sql = `
      SELECT 
        pa.*,
        pt.name as product_type_name,
        COUNT(pav.id) as value_count
      FROM product_attributes pa
      LEFT JOIN product_types pt ON pa.product_type_id = pt.id
      LEFT JOIN product_attribute_values pav ON pa.id = pav.attribute_id AND pav.status = 1
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (pa.name LIKE ? OR pa.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (product_type_id) {
      sql += ` AND pa.product_type_id = ?`;
      params.push(product_type_id);
    }

    if (status !== null) {
      sql += ` AND pa.status = ?`;
      params.push(status);
    }

    sql += ` GROUP BY pa.id ORDER BY pa.sort_order ASC, pa.created_at DESC`;

    // 分页
    const offset = (pageNum - 1) * limitNum;
    sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const attributes = await query(sql, params);
    return attributes;
  }

  // 根据ID获取属性
  static async getById(id) {
    const sql = `
      SELECT 
        pa.*,
        pt.name as product_type_name
      FROM product_attributes pa
      LEFT JOIN product_types pt ON pa.product_type_id = pt.id
      WHERE pa.id = ?
    `;
    const result = await query(sql, [id]);
    return result[0] || null;
  }

  // 创建属性
  static async create(data) {
    const {
      product_type_id,
      name,
      attribute_key,
      description = '',
      value_type = 'single',
      is_required = 0,
      sort_order = 0,
      status = 1
    } = data;

    const sql = `
      INSERT INTO product_attributes (
        product_type_id, name, attribute_key, description, 
        value_type, is_required, sort_order, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      product_type_id, name, attribute_key, description,
      value_type, is_required, sort_order, status
    ]);
    return result.insertId;
  }

  // 更新属性
  static async update(id, data) {
    const {
      name,
      attribute_key,
      description,
      value_type,
      is_required,
      sort_order,
      status
    } = data;

    const sql = `
      UPDATE product_attributes 
      SET name = ?, attribute_key = ?, description = ?, value_type = ?, 
          is_required = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await query(sql, [
      name, attribute_key, description, value_type,
      is_required, sort_order, status, id
    ]);
    return result.affectedRows > 0;
  }

  // 删除属性
  static async delete(id) {
    const sql = `DELETE FROM product_attributes WHERE id = ?`;
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 获取属性的值列表
  static async getValues(attributeId) {
    const sql = `
      SELECT * FROM product_attribute_values 
      WHERE attribute_id = ? AND status = 1
      ORDER BY sort_order ASC, created_at ASC
    `;
    return await query(sql, [attributeId]);
  }

  // 批量创建属性值
  static async createValues(attributeId, values) {
    if (!values || values.length === 0) return [];

    // 构建批量插入的SQL语句
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO product_attribute_values (
        attribute_id, value, label, color, image, sort_order, status
      ) VALUES ${placeholders}
    `;
    
    const params = [];
    values.forEach((value, index) => {
      const v = (value.value && String(value.value).trim()) || (value.label && String(value.label).trim()) || ''
      const label = (value.label && String(value.label).trim()) || v
      params.push(
        attributeId,
        v,
        label,
        value.color || null,
        value.image || null,
        value.sort_order || index + 1,
        value.status != null ? value.status : 1
      );
    });

    const result = await query(sql, params);
    return result.insertId;
  }

  // 更新属性值
  static async updateValue(id, data) {
    const { value, label, color, image, sort_order, status } = data;
    
    const sql = `
      UPDATE product_attribute_values 
      SET value = ?, label = ?, color = ?, image = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await query(sql, [value, label, color, image, sort_order, status, id]);
    return result.affectedRows > 0;
  }

  // 删除属性值
  static async deleteValue(id) {
    const sql = `DELETE FROM product_attribute_values WHERE id = ?`;
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 根据商品类型获取所有属性（包含值）
  static async getByProductType(productTypeId) {
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
    const attributes = await query(sql, [productTypeId]);
    
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
}

module.exports = ProductAttribute;

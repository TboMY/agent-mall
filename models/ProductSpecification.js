const { query } = require('../config/database');

class ProductSpecification {
  // 获取商品的规格列表
  static async getByProductId(productId) {
    const sql = `
      SELECT 
        ps.*,
        pa.name as attribute_name,
        pa.attribute_key,
        pa.value_type,
        pav.value as predefined_value,
        pav.label as predefined_label,
        pav.color as predefined_color,
        pav.image as predefined_image
      FROM product_specifications ps
      LEFT JOIN product_attributes pa ON ps.attribute_id = pa.id
      LEFT JOIN product_attribute_values pav ON ps.attribute_value_id = pav.id
      WHERE ps.product_id = ?
      ORDER BY pa.sort_order ASC
    `;
    return await query(sql, [productId]);
  }

  // 创建商品规格
  static async create(data) {
    const {
      product_id,
      attribute_id,
      attribute_value_id = null,
      custom_value = null
    } = data;

    const sql = `
      INSERT INTO product_specifications (product_id, attribute_id, attribute_value_id, custom_value)
      VALUES (?, ?, ?, ?)
    `;
    const result = await query(sql, [product_id, attribute_id, attribute_value_id, custom_value]);
    return result.insertId;
  }

  // 批量创建商品规格
  static async createBatch(specifications) {
    if (!specifications || specifications.length === 0) return [];

    // 构建批量插入的SQL
    const placeholders = specifications.map(() => '(?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO product_specifications (product_id, attribute_id, attribute_value_id, custom_value)
      VALUES ${placeholders}
    `;
    
    const valuesData = specifications.flatMap(spec => [
      spec.product_id,
      spec.attribute_id,
      spec.attribute_value_id || null,
      spec.custom_value || null
    ]);

    const result = await query(sql, valuesData);
    return result.insertId;
  }

  // 更新商品规格
  static async update(id, data) {
    const { attribute_value_id, custom_value } = data;
    
    const sql = `
      UPDATE product_specifications 
      SET attribute_value_id = ?, custom_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await query(sql, [attribute_value_id, custom_value, id]);
    return result.affectedRows > 0;
  }

  // 删除商品规格
  static async delete(id) {
    const sql = `DELETE FROM product_specifications WHERE id = ?`;
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 删除商品的所有规格
  static async deleteByProductId(productId) {
    const sql = `DELETE FROM product_specifications WHERE product_id = ?`;
    const result = await query(sql, [productId]);
    return result.affectedRows;
  }

  // 根据商品ID和属性ID获取规格
  static async getByProductAndAttribute(productId, attributeId) {
    const sql = `
      SELECT 
        ps.*,
        pa.name as attribute_name,
        pa.attribute_key,
        pa.value_type,
        pav.value as predefined_value,
        pav.label as predefined_label,
        pav.color as predefined_color,
        pav.image as predefined_image
      FROM product_specifications ps
      LEFT JOIN product_attributes pa ON ps.attribute_id = pa.id
      LEFT JOIN product_attribute_values pav ON ps.attribute_value_id = pav.id
      WHERE ps.product_id = ? AND ps.attribute_id = ?
    `;
    const result = await query(sql, [productId, attributeId]);
    return result[0] || null;
  }

  // 批量更新商品规格
  static async updateBatch(productId, specifications) {
    // 先删除现有规格
    await this.deleteByProductId(productId);
    
    // 再批量创建新规格
    if (specifications && specifications.length > 0) {
      const specsWithProductId = specifications.map(spec => ({
        ...spec,
        product_id: productId
      }));
      return await this.createBatch(specsWithProductId);
    }
    
    return 0;
  }

  // 获取规格的格式化数据（用于前端显示）
  static async getFormattedByProductId(productId) {
    const specifications = await this.getByProductId(productId);
    
    return specifications.map(spec => ({
      id: spec.id,
      attribute_id: spec.attribute_id,
      attribute_name: spec.attribute_name,
      attribute_key: spec.attribute_key,
      value_type: spec.value_type,
      value: spec.custom_value || spec.predefined_value,
      label: spec.predefined_label || spec.custom_value,
      color: spec.predefined_color,
      image: spec.predefined_image,
      is_custom: !!spec.custom_value
    }));
  }
}

module.exports = ProductSpecification;

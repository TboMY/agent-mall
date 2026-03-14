const { query } = require('../config/database');

class Brand {
  // 获取所有品牌
  static async getAll() {
    const sql = `
      SELECT * FROM brands 
      WHERE status = 1 
      ORDER BY name ASC
    `;
    return await query(sql);
  }

  // 根据ID获取品牌
  static async getById(id) {
    const sql = 'SELECT * FROM brands WHERE id = ?';
    const [brand] = await query(sql, [id]);
    return brand;
  }

  // 创建品牌
  static async create(brandData) {
    const { name, logo, description, website, status = 1 } = brandData;
    
    const sql = `
      INSERT INTO brands (name, logo, description, website, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [name, logo, description, website, status]);
    return result.insertId;
  }

  // 更新品牌
  static async update(id, brandData) {
    const fields = [];
    const params = [];

    Object.keys(brandData).forEach(key => {
      if (brandData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(brandData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const sql = `UPDATE brands SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params);
    return result.affectedRows > 0;
  }

  // 删除品牌
  static async delete(id) {
    // 检查是否有商品使用该品牌
    const productsSql = 'SELECT COUNT(*) as count FROM products WHERE brand_id = ?';
    const [productsResult] = await query(productsSql, [id]);
    
    if (productsResult.count > 0) {
      throw new Error('该品牌下还有商品，无法删除');
    }

    const sql = 'DELETE FROM brands WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Brand;

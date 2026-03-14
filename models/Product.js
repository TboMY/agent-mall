const { query } = require('../config/database');
const ProductSpecification = require('./ProductSpecification');

class Product {
  // 获取商品列表（支持分页、搜索、筛选）
  static async getProducts(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      category_id = null,
      brand_id = null,
      status = null,
      is_ai_recommended = null,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = options;

    // 确保page和limit是数字类型
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    let sql = `
      SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name,
        pt.name as product_type_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN product_types pt ON p.product_type_id = pt.id
      WHERE 1=1
    `;
    
    const params = [];

    // 搜索条件
    if (search) {
      sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // 分类筛选
    if (category_id) {
      sql += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    // 品牌筛选
    if (brand_id) {
      sql += ` AND p.brand_id = ?`;
      params.push(brand_id);
    }

    // 状态筛选
    if (status !== null) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    // AI推荐筛选
    if (is_ai_recommended !== null) {
      sql += ` AND p.is_ai_recommended = ?`;
      params.push(is_ai_recommended);
    }

    // 排序
    const allowedSortFields = ['created_at', 'updated_at', 'price', 'heat_score', 'sales_count', 'view_count'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY p.${sortField} ${order}`;

    // 分页 - 使用字符串拼接避免MySQL2参数化查询问题
    const offset = (pageNum - 1) * limitNum;
    sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const products = await query(sql, params);

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM products p
      WHERE 1=1
    `;
    const countParams = [];
    
    if (search) {
      countSql += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) {
      countSql += ` AND p.category_id = ?`;
      countParams.push(category_id);
    }
    if (brand_id) {
      countSql += ` AND p.brand_id = ?`;
      countParams.push(brand_id);
    }
    if (status !== null) {
      countSql += ` AND p.status = ?`;
      countParams.push(status);
    }
    if (is_ai_recommended !== null) {
      countSql += ` AND p.is_ai_recommended = ?`;
      countParams.push(is_ai_recommended);
    }

    const [countResult] = await query(countSql, countParams);
    const total = countResult.total;

    return {
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  // 根据ID获取商品详情
  static async getById(id) {
    const sql = `
      SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name,
        pt.name as product_type_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN product_types pt ON p.product_type_id = pt.id
      WHERE p.id = ?
    `;
    const [product] = await query(sql, [id]);
    
    if (product) {
      // 获取商品规格信息
      const specifications = await ProductSpecification.getByProductId(id);
      
      // 将规格信息转换为前端期望的格式
      const specificationsObj = {};
      specifications.forEach(spec => {
        if (spec.value_type === 'multiple') {
          // 多选类型，需要处理为数组
          if (!specificationsObj[spec.attribute_id]) {
            specificationsObj[spec.attribute_id] = [];
          }
          if (spec.attribute_value_id) {
            specificationsObj[spec.attribute_id].push(spec.attribute_value_id);
          }
        } else {
          // 单选或自定义类型
          specificationsObj[spec.attribute_id] = spec.attribute_value_id || spec.custom_value;
        }
      });
      
      product.specifications = specificationsObj;
    }
    
    return product;
  }

  // 创建商品
  static async create(productData) {
    const {
      name,
      description,
      price,
      original_price,
      image,
      images,
      category_id,
      brand_id,
      product_type_id,
      specifications,
      sku,
      stock,
      heat_score,
      is_ai_recommended,
      ai_recommendation,
      source_platform,
      source_url,
      tags,
      status = 1,
      ai_candidate_id // 新增：AI候选商品ID
    } = productData;

    const sql = `
      INSERT INTO products (
        name, description, price, original_price, image, images,
        category_id, brand_id, product_type_id, sku, stock, heat_score,
        is_ai_recommended, ai_recommendation, source_platform,
        source_url, tags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      name, 
      description || '', 
      price, 
      original_price || null, 
      image,
      images ? JSON.stringify(images) : null,
      category_id, 
      brand_id || null, 
      product_type_id || null, 
      sku || '', 
      stock || 0, 
      heat_score || 0,
      is_ai_recommended || 0, 
      ai_recommendation || '', 
      source_platform || '',
      source_url || '', 
      tags ? JSON.stringify(tags) : null, 
      status
    ];

    const result = await query(sql, params);
    const productId = result.insertId;

    // 处理规格信息
    if (specifications && Object.keys(specifications).length > 0) {
      await this.saveSpecifications(productId, specifications);
    }

    // 如果是从AI推荐创建的，更新AI候选商品状态
    if (ai_candidate_id) {
      await this.updateAICandidateStatus(ai_candidate_id, productId);
    }

    return productId;
  }

  // 更新商品
  static async update(id, productData) {
    const fields = [];
    const params = [];
    const { specifications, ...otherData } = productData;

    // 动态构建更新字段
    Object.keys(otherData).forEach(key => {
      if (otherData[key] !== undefined) {
        if (key === 'images' || key === 'tags') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(otherData[key]));
        } else {
          fields.push(`${key} = ?`);
          params.push(otherData[key]);
        }
      }
    });

    if (fields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params);
    
    // 处理规格信息
    if (specifications !== undefined) {
      await this.saveSpecifications(id, specifications);
    }
    
    return result.affectedRows > 0;
  }

  // 删除商品
  static async delete(id) {
    const sql = 'DELETE FROM products WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 批量删除商品
  static async batchDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('请提供有效的商品ID列表');
    }

    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM products WHERE id IN (${placeholders})`;
    const result = await query(sql, ids);
    return result.affectedRows;
  }

  // 更新商品状态
  static async updateStatus(id, status) {
    const sql = 'UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?';
    const result = await query(sql, [status, id]);
    return result.affectedRows > 0;
  }

  // 更新商品库存
  static async updateStock(id, stock) {
    const sql = 'UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?';
    const result = await query(sql, [stock, id]);
    return result.affectedRows > 0;
  }

  // 增加商品浏览量
  static async incrementViewCount(id) {
    const sql = 'UPDATE products SET view_count = view_count + 1 WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 增加商品销量
  static async incrementSalesCount(id, quantity = 1) {
    const sql = 'UPDATE products SET sales_count = sales_count + ? WHERE id = ?';
    const result = await query(sql, [quantity, id]);
    return result.affectedRows > 0;
  }

  // 获取AI推荐商品
  static async getAIRecommended(limit = 10) {
    const limitNum = parseInt(limit) || 10;
    const sql = `
      SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_ai_recommended = 1 AND p.status = 1
      ORDER BY p.heat_score DESC, p.created_at DESC
      LIMIT ${limitNum}
    `;
    return await query(sql, []);
  }

  // 获取热门商品
  static async getHotProducts(limit = 10) {
    const limitNum = parseInt(limit) || 10;
    const sql = `
      SELECT 
        p.*,
        c.name as category_name,
        b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.status = 1
      ORDER BY p.heat_score DESC, p.sales_count DESC
      LIMIT ${limitNum}
    `;
    return await query(sql, []);
  }

  // 保存商品规格信息
  static async saveSpecifications(productId, specifications) {
    // 先删除现有规格
    await ProductSpecification.deleteByProductId(productId);
    
    if (!specifications || Object.keys(specifications).length === 0) {
      return;
    }

    // 准备规格数据
    const specificationsData = [];
    
    for (const [attributeId, value] of Object.entries(specifications)) {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          // 多选类型
          value.forEach(val => {
            if (val !== null && val !== undefined && val !== '') {
              specificationsData.push({
                product_id: productId,
                attribute_id: parseInt(attributeId),
                attribute_value_id: typeof val === 'number' ? val : null,
                custom_value: typeof val === 'string' ? val : null
              });
            }
          });
        } else {
          // 单选或自定义类型
          specificationsData.push({
            product_id: productId,
            attribute_id: parseInt(attributeId),
            attribute_value_id: typeof value === 'number' ? value : null,
            custom_value: typeof value === 'string' ? value : null
          });
        }
      }
    }

    // 批量创建规格
    if (specificationsData.length > 0) {
      await ProductSpecification.createBatch(specificationsData);
    }
  }

  // 更新AI候选商品状态（当从AI推荐创建正式商品时）
  static async updateAICandidateStatus(aiCandidateId, productId) {
    const AIProductCandidate = require('./AIProductCandidate');
    
    try {
      // 更新AI候选商品状态为已上架，并关联正式商品ID
      await AIProductCandidate.update(aiCandidateId, {
        status: 1, // 已上架
        linked_product_id: productId
      });
      
      console.log(`AI候选商品 ${aiCandidateId} 已审核通过，关联到正式商品 ${productId}`);
    } catch (error) {
      console.error('更新AI候选商品状态失败:', error);
      // 这里不抛出错误，避免影响商品创建流程
    }
  }
}

module.exports = Product;

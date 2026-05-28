const { query } = require('../config/database');

class AIProductCandidate {
  static normalizeProductNameExpression() {
    return `LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(TRIM(COALESCE(product_name, '')), ' ', ''),
            '-', ''),
          '_', ''),
        '（', '('),
      '）', ')')
    )`;
  }

  static buildFilterClause(options = {}) {
    const {
      search = '',
      status = null,
      product_name = null,
      start_time = null,
      end_time = null
    } = options;

    const clauses = ['1=1'];
    const params = [];

    if (search) {
      clauses.push(`(product_name LIKE ? OR ai_reason LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status !== null) {
      clauses.push(`status = ?`);
      params.push(status);
    }

    if (product_name) {
      clauses.push(`product_name LIKE ?`);
      params.push(`%${product_name}%`);
    }

    if (start_time) {
      clauses.push(`created_at >= ?`);
      params.push(start_time);
    }

    if (end_time) {
      clauses.push(`created_at <= ?`);
      params.push(end_time);
    }

    return {
      whereSql: clauses.join(' AND '),
      params
    };
  }

  // 获取AI推荐候选商品列表（支持分页、搜索、筛选）
  static async getCandidates(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = null,
      product_name = null,
      sort_by = 'created_at',
      sort_order = 'DESC',
      start_time = null,
      end_time = null,
      dedupe = true
    } = options;

    // 确保page和limit是数字类型
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const shouldDedupe = dedupe !== false && dedupe !== 'false' && dedupe !== 0 && dedupe !== '0';
    const { whereSql, params } = this.buildFilterClause({
      search,
      status,
      product_name,
      start_time,
      end_time
    });

    // 排序
    const allowedSortFields = ['created_at', 'updated_at', 'hot_score'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 分页
    const offset = (pageNum - 1) * limitNum;
    const normalizedNameExpr = this.normalizeProductNameExpression();

    let sql;
    let countSql;
    if (shouldDedupe) {
      sql = `
        WITH ranked_candidates AS (
          SELECT
            *,
            ${normalizedNameExpr} AS normalized_product_name,
            COUNT(*) OVER (
              PARTITION BY CASE
                WHEN ${normalizedNameExpr} = '' THEN CONCAT('__empty__', id)
                ELSE ${normalizedNameExpr}
              END
            ) AS duplicate_count,
            ROW_NUMBER() OVER (
              PARTITION BY CASE
                WHEN ${normalizedNameExpr} = '' THEN CONCAT('__empty__', id)
                ELSE ${normalizedNameExpr}
              END
              ORDER BY hot_score DESC, created_at DESC, id DESC
            ) AS row_num
          FROM ai_product_candidate
          WHERE ${whereSql}
        )
        SELECT *
        FROM ranked_candidates
        WHERE row_num = 1
        ORDER BY ${sortField} ${order}, id DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;

      countSql = `
        SELECT COUNT(*) AS total
        FROM (
          SELECT
            CASE
              WHEN ${normalizedNameExpr} = '' THEN CONCAT('__empty__', id)
              ELSE ${normalizedNameExpr}
            END AS dedupe_key
          FROM ai_product_candidate
          WHERE ${whereSql}
          GROUP BY dedupe_key
        ) AS deduped
      `;
    } else {
      sql = `
        SELECT *, 1 AS duplicate_count
        FROM ai_product_candidate
        WHERE ${whereSql}
        ORDER BY ${sortField} ${order}, id DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;

      countSql = `
        SELECT COUNT(*) as total
        FROM ai_product_candidate
        WHERE ${whereSql}
      `;
    }

    const candidates = await query(sql, params);
    const [countResult] = await query(countSql, params);
    const total = countResult.total;

    return {
      candidates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  // 根据ID获取候选商品详情
  static async getById(id) {
    const sql = `
      SELECT *
      FROM ai_product_candidate
      WHERE id = ?
    `;
    const [candidate] = await query(sql, [id]);
    return candidate;
  }

  // 创建候选商品
  static async create(candidateData) {
    const {
      aweme_id,
      source_content_id,
      source_platform,
      platform_content_id,
      content_type = 'video',
      product_name,
      product_category,
      ai_reason,
      hot_score,
      cover_url,
      download_url,
      source_url,
      source_keyword,
      status = 0
    } = candidateData;

    const sql = `
      INSERT INTO ai_product_candidate (
        aweme_id, source_content_id, source_platform, platform_content_id, content_type,
        product_name, product_category, ai_reason, hot_score,
        cover_url, download_url, source_url, source_keyword, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      aweme_id,
      source_content_id || null,
      source_platform || null,
      platform_content_id || null,
      content_type,
      product_name,
      product_category,
      ai_reason,
      hot_score || 0,
      cover_url,
      download_url,
      source_url,
      source_keyword,
      status
    ];

    const result = await query(sql, params);
    return result.insertId;
  }

  static async getBySourceContentId(sourceContentId) {
    const sql = `
      SELECT *
      FROM ai_product_candidate
      WHERE source_content_id = ?
      LIMIT 1
    `;
    const [candidate] = await query(sql, [sourceContentId]);
    return candidate || null;
  }

  // 更新候选商品
  static async update(id, candidateData) {
    const fields = [];
    const params = [];

    // 动态构建更新字段
    Object.keys(candidateData).forEach(key => {
      if (candidateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(candidateData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    fields.push('updated_at = NOW()');
    params.push(id);

    const sql = `UPDATE ai_product_candidate SET ${fields.join(', ')} WHERE id = ?`;
    const result = await query(sql, params);
    
    return result.affectedRows > 0;
  }

  // 删除候选商品
  static async delete(id) {
    const sql = 'DELETE FROM ai_product_candidate WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // 批量更新候选商品状态
  static async batchUpdateStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('请提供有效的候选商品ID列表');
    }

    const placeholders = ids.map(() => '?').join(',');
    const sql = `UPDATE ai_product_candidate SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`;
    const params = [status, ...ids];
    const result = await query(sql, params);
    return result.affectedRows;
  }

  // 更新候选商品状态
  static async updateStatus(id, status) {
    const sql = 'UPDATE ai_product_candidate SET status = ?, updated_at = NOW() WHERE id = ?';
    const result = await query(sql, [status, id]);
    return result.affectedRows > 0;
  }

  // 将候选商品转换为正式商品
  static async convertToProduct(candidateId, productData) {
    const candidate = await this.getById(candidateId);
    if (!candidate) {
      throw new Error('候选商品不存在');
    }

    // 创建正式商品
    const Product = require('./Product');
    const productId = await Product.create({
      ...productData,
      name: candidate.product_name,
      description: candidate.ai_reason,
      image: candidate.cover_url,
      heat_score: candidate.hot_score,
      is_ai_recommended: 1,
      ai_recommendation: candidate.ai_reason,
      source_platform: candidate.source_platform || 'douyin',
      source_url: candidate.source_url,
      download_url: candidate.download_url,
      status: 1
    });

    // 更新候选商品状态为已上架，并关联正式商品ID
    await this.update(candidateId, {
      status: 1,
      linked_product_id: productId
    });

    return productId;
  }

  // 获取统计信息
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as rejected,
        AVG(hot_score) as avg_hot_score
      FROM ai_product_candidate
    `;
    const [stats] = await query(sql, []);
    return stats;
  }
}

module.exports = AIProductCandidate;

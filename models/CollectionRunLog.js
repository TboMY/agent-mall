const { query } = require('../config/database');

class CollectionRunLog {
  static async create({ platform, keywords, limit, status = 'running', collected_count = 0, error_message = null }) {
    const sql = `
      INSERT INTO crawler_collection_runs (
        platform, keywords, limit_count, status, collected_count, error_message
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      platform,
      keywords,
      Number(limit || 0),
      status,
      Number(collected_count || 0),
      error_message
    ]);
    return result.insertId;
  }

  static async finish(id, { status = 'success', collected_count = 0, error_message = null } = {}) {
    const sql = `
      UPDATE crawler_collection_runs
      SET status = ?, collected_count = ?, error_message = ?, finished_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `;
    const result = await query(sql, [status, Number(collected_count || 0), error_message, id]);
    return result.affectedRows > 0;
  }

  static async list({ platform = null, status = null, page = 1, limit = 20 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    const params = [];
    let sql = `
      SELECT *
      FROM crawler_collection_runs
      WHERE 1 = 1
    `;

    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC, id DESC LIMIT ${safeLimit} OFFSET ${offset}`;
    const items = await query(sql, params);

    let countSql = 'SELECT COUNT(*) AS total FROM crawler_collection_runs WHERE 1 = 1';
    const countParams = [];
    if (platform) {
      countSql += ' AND platform = ?';
      countParams.push(platform);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await query(countSql, countParams);
    return {
      items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: Number(countResult?.total || 0),
        pages: Math.ceil(Number(countResult?.total || 0) / safeLimit)
      }
    };
  }
}

module.exports = CollectionRunLog;

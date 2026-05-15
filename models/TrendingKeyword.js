const { query } = require('../config/database');

class TrendingKeyword {
  static normalizeKeyword(value) {
    return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
  }

  static getDedupDays() {
    const dedupDays = Number(process.env.HOTLIST_KEYWORD_DEDUP_DAYS || 2);
    return Number.isFinite(dedupDays) && dedupDays > 0 ? dedupDays : 2;
  }

  static async findRecentDuplicate(source, keyword) {
    const sql = `
      SELECT id
      FROM trending_keywords
      WHERE source = ?
        AND REPLACE(LOWER(keyword), ' ', '') = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY id DESC
      LIMIT 1
    `;
    const [row] = await query(sql, [source, this.normalizeKeyword(keyword), this.getDedupDays()]);
    return row || null;
  }

  static async createMany({ source = 'manual', keywords = [], snapshotTime = null } = {}) {
    if (!Array.isArray(keywords) || keywords.length === 0) return [];

    const createdIds = [];
    const seenKeywords = new Set();
    for (const item of keywords) {
      const normalized = typeof item === 'string'
        ? { keyword: item }
        : (item || {});
      const keyword = String(normalized.keyword || '').trim();
      if (!keyword) continue;
      const normalizedKeyword = this.normalizeKeyword(keyword);
      if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) continue;
      seenKeywords.add(normalizedKeyword);

      const duplicate = await this.findRecentDuplicate(source, keyword);
      if (duplicate) {
        const updateSql = `
          UPDATE trending_keywords
          SET raw_rank = ?,
              raw_score = ?,
              snapshot_time = ?,
              status = 'pending',
              updated_at = NOW()
          WHERE id = ?
        `;
        await query(updateSql, [
          normalized.raw_rank ?? null,
          normalized.raw_score ?? null,
          normalized.snapshot_time || snapshotTime || null,
          duplicate.id
        ]);
        createdIds.push(duplicate.id);
        continue;
      }

      const sql = `
        INSERT INTO trending_keywords (
          source, keyword, raw_rank, raw_score, snapshot_time, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `;
      const result = await query(sql, [
        source,
        keyword,
        normalized.raw_rank ?? null,
        normalized.raw_score ?? null,
        normalized.snapshot_time || snapshotTime || null
      ]);
      createdIds.push(result.insertId);
    }

    return createdIds;
  }

  static async list({ source = null, status = null, page = 1, limit = 20 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    const params = [];

    let sql = `
      SELECT *
      FROM trending_keywords
      WHERE 1 = 1
    `;

    if (source) {
      sql += ` AND source = ?`;
      params.push(source);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC, id DESC LIMIT ${safeLimit} OFFSET ${offset}`;
    const items = await query(sql, params);

    let countSql = `SELECT COUNT(*) AS total FROM trending_keywords WHERE 1 = 1`;
    const countParams = [];
    if (source) {
      countSql += ` AND source = ?`;
      countParams.push(source);
    }
    if (status) {
      countSql += ` AND status = ?`;
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

  static async getPending({ limit = 20, ids = [] } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const params = [];
    let sql = `
      SELECT *
      FROM trending_keywords
      WHERE status = 'pending'
    `;

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      sql += ` AND id IN (${placeholders})`;
      params.push(...ids);
    }

    sql += ` ORDER BY created_at ASC, id ASC LIMIT ${safeLimit}`;
    return await query(sql, params);
  }

  static async updateStatus(id, status) {
    const sql = `
      UPDATE trending_keywords
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const result = await query(sql, [status, id]);
    return result.affectedRows > 0;
  }
}

module.exports = TrendingKeyword;

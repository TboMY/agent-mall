const { query } = require('../config/database');

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function buildPlatformFilter(sql, params, platform) {
  if (!platform) return sql;
  sql += ` AND JSON_CONTAINS(platforms, JSON_QUOTE(?))`;
  params.push(platform);
  return sql;
}

/**
 * 商业关键词池模型。
 * 负责维护可供采集流程消费的关键词，以及它们的使用状态和调度顺序。
 */
class CommercialKeyword {
  static normalizeKeyword(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }

  static getKeywordDedupDays() {
    const dedupDays = Number(process.env.COMMERCIAL_KEYWORD_DEDUP_DAYS || 2);
    return Number.isFinite(dedupDays) && dedupDays > 0 ? dedupDays : 2;
  }

  static getFreshKeywordDays() {
    const freshDays = Number(process.env.COLLECTOR_NEW_KEYWORD_DAYS || 2);
    return Number.isFinite(freshDays) && freshDays > 0 ? freshDays : 2;
  }

  static getRetryCooldownHours() {
    const cooldownHours = Number(process.env.COLLECTOR_KEYWORD_RETRY_HOURS || 24);
    return Number.isFinite(cooldownHours) && cooldownHours >= 0 ? cooldownHours : 24;
  }

  static buildTopicKey(keyword) {
    const normalized = this.normalizeKeyword(keyword);
    if (!normalized) return '';
    return normalized.slice(0, Math.min(4, normalized.length));
  }

  static commonPrefixLength(left, right) {
    const a = this.normalizeKeyword(left);
    const b = this.normalizeKeyword(right);
    const max = Math.min(a.length, b.length);
    let index = 0;
    while (index < max && a[index] === b[index]) {
      index += 1;
    }
    return index;
  }

  static isSimilarKeyword(left, right) {
    const a = this.normalizeKeyword(left);
    const b = this.normalizeKeyword(right);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 4 && (a.includes(b) || b.includes(a))) return true;
    return this.buildTopicKey(a) === this.buildTopicKey(b) && this.commonPrefixLength(a, b) >= 2;
  }

  static async findRecentSimilarKeyword(source, keyword) {
    const rows = await query(
      `SELECT id, keyword, priority, confidence
       FROM commercial_keywords
       WHERE source = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY priority DESC, confidence DESC, id DESC
       LIMIT 50`,
      [source || 'manual', this.getKeywordDedupDays()]
    );
    return rows.find(row => this.isSimilarKeyword(row.keyword, keyword)) || null;
  }

  /**
   * 规范化数据库行，当前主要把 JSON platforms 解析成数组。
   */
  static normalizeRow(row) {
    return {
      ...row,
      platforms: parseJson(row.platforms, [])
    };
  }

  /**
   * 批量 upsert 商业关键词。
   */
  static async upsertMany(keywords = []) {
    const ids = [];
    for (const keywordData of keywords) {
      ids.push(await this.upsert(keywordData));
    }
    return ids.filter(Boolean);
  }

  /**
   * 新增或更新单个商业关键词。
   */
  static async upsert(keywordData) {
    const keyword = String(keywordData.keyword || '').trim();
    if (!keyword) return null;
    const source = keywordData.source || 'manual';

    const similarKeyword = await this.findRecentSimilarKeyword(source, keyword);
    if (similarKeyword && this.normalizeKeyword(similarKeyword.keyword) !== this.normalizeKeyword(keyword)) {
      const incomingPriority = Number(keywordData.priority || 50);
      const incomingConfidence = Number(keywordData.confidence ?? 0);
      const existingPriority = Number(similarKeyword.priority || 0);
      const existingConfidence = Number(similarKeyword.confidence || 0);
      if (incomingPriority <= existingPriority && incomingConfidence <= existingConfidence) {
        return similarKeyword.id;
      }
    }

    const sql = `
      INSERT INTO commercial_keywords (
        keyword, source_keyword_id, source, category, priority,
        platforms, confidence, reason, status, valid_until,
        attempt_count, last_attempted_at, last_attempt_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)
      ON DUPLICATE KEY UPDATE
        source_keyword_id = VALUES(source_keyword_id),
        source = VALUES(source),
        category = VALUES(category),
        priority = VALUES(priority),
        platforms = VALUES(platforms),
        confidence = VALUES(confidence),
        reason = VALUES(reason),
        status = VALUES(status),
        valid_until = VALUES(valid_until),
        updated_at = NOW()
    `;

    const result = await query(sql, [
      keyword,
      keywordData.source_keyword_id || null,
      source,
      keywordData.category || '',
      Number(keywordData.priority || 50),
      JSON.stringify(keywordData.platforms || ['douyin', 'bilibili']),
      keywordData.confidence ?? 0,
      keywordData.reason || '',
      keywordData.status || 'active',
      keywordData.valid_until || null
    ]);

    return result.insertId || null;
  }

  /**
   * 按主键查询单个商业关键词。
   */
  static async getById(id) {
    const sql = `
      SELECT *
      FROM commercial_keywords
      WHERE id = ?
      LIMIT 1
    `;
    const [row] = await query(sql, [id]);
    return row ? this.normalizeRow(row) : null;
  }

  /**
   * 分页查询商业关键词列表。
   */
  static async list({ platform = null, status = null, page = 1, limit = 20 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    const params = [];

    let sql = `
      SELECT *
      FROM commercial_keywords
      WHERE 1 = 1
    `;

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql = buildPlatformFilter(sql, params, platform);

    sql += ` ORDER BY priority DESC, confidence DESC, collect_count ASC, updated_at DESC LIMIT ${safeLimit} OFFSET ${offset}`;
    const items = (await query(sql, params)).map(row => this.normalizeRow(row));

    let countSql = `SELECT COUNT(*) AS total FROM commercial_keywords WHERE 1 = 1`;
    const countParams = [];
    if (status) {
      countSql += ` AND status = ?`;
      countParams.push(status);
    }
    countSql = buildPlatformFilter(countSql, countParams, platform);

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

  /**
   * 为采集任务挑选一批关键词。
   * 调度策略是“优先近两天新词，再补未使用旧词，最后轮转已使用词”。
   */
  static async pickForCollection({ platform = null, limit = 10 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
    const freshDays = this.getFreshKeywordDays();
    const baseParams = [];
    let baseSql = `
      SELECT *
      FROM commercial_keywords
      WHERE status = 'active'
        AND (valid_until IS NULL OR valid_until >= NOW())
        AND (
          last_attempted_at IS NULL
          OR last_attempted_at < DATE_SUB(NOW(), INTERVAL ${this.getRetryCooldownHours()} HOUR)
        )
    `;

    baseSql = buildPlatformFilter(baseSql, baseParams, platform);

    const freshSql = `
      ${baseSql}
        AND collect_count = 0
        AND created_at >= DATE_SUB(NOW(), INTERVAL ${freshDays} DAY)
      ORDER BY created_at DESC, priority DESC, confidence DESC
      LIMIT ${safeLimit}
    `;
    const freshItems = (await query(freshSql, baseParams)).map(row => this.normalizeRow(row));

    const excludedIds = freshItems.map(item => item.id);
    const unusedLegacyParams = [...baseParams];
    let unusedLegacySql = baseSql;
    if (excludedIds.length > 0) {
      unusedLegacySql += ` AND id NOT IN (${excludedIds.map(() => '?').join(',')})`;
      unusedLegacyParams.push(...excludedIds);
    }
    unusedLegacySql += `
      AND collect_count = 0
      ORDER BY created_at DESC, priority DESC, confidence DESC
      LIMIT ${safeLimit}
    `;
    const unusedLegacyItems = (await query(unusedLegacySql, unusedLegacyParams)).map(row => this.normalizeRow(row));

    const picked = [...freshItems];
    for (const item of unusedLegacyItems) {
      if (picked.some(existing => existing.id === item.id)) continue;
      picked.push(item);
      if (picked.length >= safeLimit) break;
    }

    const usedParams = [...baseParams];
    let usedSql = baseSql;
    const pickedIds = picked.map(item => item.id);
    if (pickedIds.length > 0) {
      usedSql += ` AND id NOT IN (${pickedIds.map(() => '?').join(',')})`;
      usedParams.push(...pickedIds);
    }
    usedSql += `
      AND collect_count > 0
      ORDER BY
        last_collected_at ASC,
        collect_count ASC,
        priority DESC,
        confidence DESC,
        updated_at DESC
      LIMIT ${safeLimit}
    `;
    const usedItems = (await query(usedSql, usedParams)).map(row => this.normalizeRow(row));
    for (const item of usedItems) {
      if (picked.some(existing => existing.id === item.id)) continue;
      picked.push(item);
      if (picked.length >= safeLimit) break;
    }
    return picked.slice(0, safeLimit);
  }

  /**
   * 更新关键词启停状态。
   */
  static async updateStatus(id, status) {
    const sql = `
      UPDATE commercial_keywords
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const result = await query(sql, [status, id]);
    return result.affectedRows > 0;
  }

  /**
   * 获取当前词池统计信息，用于判断是否需要补热词。
   */
  static async getPoolStats({ platform = null } = {}) {
    const params = [];
    let sql = `
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN collect_count = 0 THEN 1 ELSE 0 END) AS unused_count,
        SUM(CASE WHEN collect_count > 0 THEN 1 ELSE 0 END) AS used_count
      FROM commercial_keywords
      WHERE status = 'active'
        AND (valid_until IS NULL OR valid_until >= NOW())
    `;
    sql = buildPlatformFilter(sql, params, platform);
    const [row] = await query(sql, params);
    return {
      totalCount: Number(row?.total_count || 0),
      unusedCount: Number(row?.unused_count || 0),
      usedCount: Number(row?.used_count || 0)
    };
  }

  /**
   * 获取首页可展示的近期商业热点词。
   */
  static async getHomepageKeywords(limit = 8) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 20));
    const rows = await query(
      `SELECT *
       FROM commercial_keywords
       WHERE status = 'active'
         AND (valid_until IS NULL OR valid_until >= NOW())
       ORDER BY updated_at DESC, priority DESC, confidence DESC
       LIMIT ${safeLimit}`
    );

    return rows.map((row) => this.normalizeRow(row));
  }

  /**
   * 在一次采集成功后，批量记录关键词的消费次数和最近使用时间。
   */
  static async markCollectedByKeywords(keywords = [], platform = null) {
    const normalizedKeywords = Array.from(new Set(
      (Array.isArray(keywords) ? keywords : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
    ));
    if (normalizedKeywords.length === 0) return 0;

    const params = [...normalizedKeywords];
    let sql = `
      UPDATE commercial_keywords
      SET
        collect_count = collect_count + 1,
        first_collected_at = COALESCE(first_collected_at, NOW()),
        last_collected_at = NOW(),
        last_collected_platform = ?,
        last_attempt_status = 'success',
        updated_at = NOW()
      WHERE keyword IN (${normalizedKeywords.map(() => '?').join(',')})
    `;
    params.unshift(platform || null);
    const result = await query(sql, params);
    return result.affectedRows || 0;
  }

  static async markAttemptedByKeywords(keywords = [], platform = null, status = 'running') {
    const normalizedKeywords = Array.from(new Set(
      (Array.isArray(keywords) ? keywords : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
    ));
    if (normalizedKeywords.length === 0) return 0;

    const params = [platform || null, status, ...normalizedKeywords];
    const sql = `
      UPDATE commercial_keywords
      SET
        attempt_count = attempt_count + 1,
        last_attempted_at = NOW(),
        last_collected_platform = COALESCE(?, last_collected_platform),
        last_attempt_status = ?,
        updated_at = NOW()
      WHERE keyword IN (${normalizedKeywords.map(() => '?').join(',')})
    `;
    const result = await query(sql, params);
    return result.affectedRows || 0;
  }
}

module.exports = CommercialKeyword;

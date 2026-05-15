const { query } = require('../config/database');

/**
 * 统一内容表模型。
 * 保存来自抖音/B站等平台的原始内容，并跟踪其 AI 分析状态。
 */
class SourceContentItem {
  /**
   * 新增或更新单条平台内容。
   */
  static async upsert(item) {
    const sql = `
      INSERT INTO source_content_items (
        platform, platform_content_id, content_type, title, description,
        author_id, author_name, author_avatar, cover_url, source_url, play_url,
        publish_time, liked_count, comment_count, share_count, favorite_count,
        view_count, source_keyword, analysis_status, analysis_attempts,
        analysis_error, last_collected_at, raw_payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, NOW(), ?)
      ON DUPLICATE KEY UPDATE
        content_type = VALUES(content_type),
        title = VALUES(title),
        description = VALUES(description),
        author_id = VALUES(author_id),
        author_name = VALUES(author_name),
        author_avatar = VALUES(author_avatar),
        cover_url = VALUES(cover_url),
        source_url = VALUES(source_url),
        play_url = VALUES(play_url),
        publish_time = VALUES(publish_time),
        liked_count = VALUES(liked_count),
        comment_count = VALUES(comment_count),
        share_count = VALUES(share_count),
        favorite_count = VALUES(favorite_count),
        view_count = VALUES(view_count),
        source_keyword = VALUES(source_keyword),
        raw_payload = VALUES(raw_payload),
        analysis_status = 0,
        analysis_error = NULL,
        last_collected_at = NOW(),
        updated_at = NOW()
    `;

    const params = [
      item.platform,
      item.platform_content_id,
      item.content_type || 'video',
      item.title || '',
      item.description || '',
      item.author_id || null,
      item.author_name || null,
      item.author_avatar || null,
      item.cover_url || null,
      item.source_url || null,
      item.play_url || null,
      item.publish_time || null,
      Number(item.liked_count || 0),
      Number(item.comment_count || 0),
      Number(item.share_count || 0),
      Number(item.favorite_count || 0),
      Number(item.view_count || 0),
      item.source_keyword || null,
      item.raw_payload ? JSON.stringify(item.raw_payload) : null
    ];

    const result = await query(sql, params);
    return result.insertId || null;
  }

  /**
   * 批量写入平台内容。
   */
  static async upsertMany(items = []) {
    console.log(`[source-content] upsertMany start count=${items.length}`);
    const results = [];
    for (const item of items) {
      results.push(await this.upsert(item));
    }
    console.log(`[source-content] upsertMany done count=${items.length} sampleIds=${results.slice(0, 5).join(',') || '-'}`);
    return results;
  }

  /**
   * 查询待分析的内容列表。
   */
  static async getPendingForAnalysis({ platforms = [], limit = 10 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
    const params = [];
    let sql = `
      SELECT *
      FROM source_content_items
      WHERE analysis_status = 0
    `;

    if (Array.isArray(platforms) && platforms.length > 0) {
      const placeholders = platforms.map(() => '?').join(',');
      sql += ` AND platform IN (${placeholders})`;
      params.push(...platforms);
    }

    sql += ` ORDER BY publish_time DESC, id DESC LIMIT ${safeLimit}`;
    return await query(sql, params);
  }

  /**
   * 分页查询内容列表。
   */
  static async list({ platform = null, page = 1, limit = 20 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    const params = [];
    let sql = `
      SELECT *
      FROM source_content_items
      WHERE 1 = 1
    `;

    if (platform) {
      sql += ` AND platform = ?`;
      params.push(platform);
    }

    sql += ` ORDER BY publish_time DESC, id DESC LIMIT ${safeLimit} OFFSET ${offset}`;
    return await query(sql, params);
  }

  /**
   * 更新单条内容的分析状态和错误信息。
   */
  static async updateAnalysisStatus(id, status, extra = {}) {
    const fields = ['analysis_status = ?'];
    const params = [status];

    if (extra.error !== undefined) {
      fields.push('analysis_error = ?');
      params.push(extra.error);
    }

    if (extra.incrementAttempts) {
      fields.push('analysis_attempts = analysis_attempts + 1');
    }

    if (extra.setAnalyzedAt) {
      fields.push('last_analyzed_at = NOW()');
    }

    const sql = `
      UPDATE source_content_items
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;
    params.push(id);
    const result = await query(sql, params);
    return result.affectedRows > 0;
  }

  /**
   * 批量把内容标记为“分析中”。
   */
  static async markBatchProcessing(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      UPDATE source_content_items
      SET analysis_status = 1,
          analysis_attempts = analysis_attempts + 1,
          analysis_error = NULL,
          updated_at = NOW()
      WHERE id IN (${placeholders})
    `;
    const result = await query(sql, ids);
    return result.affectedRows;
  }
}

module.exports = SourceContentItem;

const { crawlerQuery } = require('../config/database');

class DouyinAweme {
  static async getById(awemeId) {
    const sql = `SELECT * FROM douyin_aweme WHERE aweme_id = ? LIMIT 1`;
    const rows = await crawlerQuery(sql, [awemeId]);
    return rows[0] || null;
  }

  static async getByIds(awemeIds = []) {
    if (!Array.isArray(awemeIds) || awemeIds.length === 0) return [];
    const placeholders = awemeIds.map(() => '?').join(',');
    const sql = `SELECT * FROM douyin_aweme WHERE aweme_id IN (${placeholders})`;
    return await crawlerQuery(sql, awemeIds);
  }

  static async list({ page = 1, pageSize = 20 } = {}) {
    const limit = Math.max(1, Math.min(pageSize, 100));
    const offset = Math.max(0, (page - 1) * limit);
    // 注意：部分 MySQL 版本对 LIMIT/OFFSET 参数化支持不佳，这里内联安全数字
    const sql = `SELECT * FROM douyin_aweme ORDER BY create_time DESC LIMIT ${limit} OFFSET ${offset}`;
    return await crawlerQuery(sql);
  }

  // 按自增 id 升序获取大于指定 id 的最新 N 条，避免重复消费
  static async listAfterId({ afterId = 0, limit = 20 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 200));
    const safeAfter = Math.max(0, Number(afterId) || 0);
    const sql = `
      SELECT *
      FROM douyin_aweme
      WHERE id > ${safeAfter}
      ORDER BY id ASC
      LIMIT ${safeLimit}
    `;
    return await crawlerQuery(sql);
  }

  static async getLatest() {
    const sql = `SELECT * FROM douyin_aweme ORDER BY id DESC LIMIT 1`;
    const rows = await crawlerQuery(sql);
    return rows[0] || null;
  }
}

module.exports = DouyinAweme;

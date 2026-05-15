const axios = require('axios');

/**
 * 热榜接口访问服务。
 * 负责向外部热榜 API 发请求，并把不同榜单的返回统一整理成内部可消费的关键词结构。
 */
class HotlistService {
  constructor() {
    this.baseURL = process.env.HOTLIST_API_BASE || 'https://api.98dou.cn';
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: Number(process.env.HOTLIST_API_TIMEOUT_MS || 15000)
    });
  }

  /**
   * 把热榜 type 归一化为内部来源标识。
   */
  normalizeSource(type) {
    return type || 'manual';
  }

  /**
   * 拉取指定 type 的热榜原始数据。
   */
  async fetchHotlist(type) {
    if (!type) {
      throw new Error('缺少热榜 type 参数');
    }

    const response = await this.http.get('/api/hotlist', {
      params: { type }
    });
    const payload = response?.data;

    if (!payload?.success || !Array.isArray(payload?.data)) {
      throw new Error(`热榜接口返回异常: ${payload?.msg || '未知错误'}`);
    }

    return payload;
  }

  /**
   * 从热榜返回中提取出关键词列表，供后续写入 trending_keywords。
   */
  normalizeKeywords(payload, type, limit = 20) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const snapshotTime = payload?.update_time || null;

    return (payload?.data || [])
      .slice(0, safeLimit)
      .map(item => ({
        keyword: String(item?.title || '').trim(),
        raw_rank: item?.index ?? null,
        raw_score: item?.hot ?? null,
        snapshot_time: snapshotTime,
        source: this.normalizeSource(type),
        raw_payload: item
      }))
      .filter(item => item.keyword);
  }
}

module.exports = new HotlistService();

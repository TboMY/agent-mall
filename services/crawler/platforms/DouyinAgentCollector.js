const { sanitizeNumber, stripHtml, sleep } = require('../utils');
const AgentCrawlerClient = require('../AgentCrawlerClient');

function chunkArray(items = [], chunkSize = 1) {
  const safeChunkSize = Math.max(1, Number(chunkSize || 1));
  const result = [];
  for (let i = 0; i < items.length; i += safeChunkSize) {
    result.push(items.slice(i, i + safeChunkSize));
  }
  return result;
}

class DouyinAgentCollector {
  constructor(options = {}) {
    this.timeoutMs = Number(options.agentTaskTimeoutMs || options.timeoutMs || 900000);
    this.sessionProfile = String(options.agentSessionProfile || 'douyin-default');
    this.taskName = String(options.agentTaskName || 'douyin_realtime_collect');
    this.resultLimitPerKeyword = Math.max(1, Number(options.resultLimitPerKeyword || 10));
    this.batchLimit = Math.max(1, Number(options.agentBatchLimit || 20));
    this.keywordBatchSize = Math.max(1, Number(options.agentKeywordBatchSize || 2));
    this.batchDelayMs = Math.max(0, Number(options.agentBatchDelayMs || 1200));
    this.bridgeTimeoutMs = Number(options.agentBridgeTimeoutMs || Math.max(this.timeoutMs + 120000, 1020000));
    this.client = new AgentCrawlerClient({
      baseURL: options.agentBridgeUrl,
      endpoint: options.agentBridgeEndpoint,
      timeoutMs: this.bridgeTimeoutMs,
      apiKey: options.agentBridgeApiKey
    });
  }

  normalizeItem(item = {}, keyword = '') {
    const stats = item.stats && typeof item.stats === 'object' ? item.stats : {};
    const author = item.author && typeof item.author === 'object' ? item.author : {};
    const platformContentId = String(item.platform_content_id || item.aweme_id || item.id || item.video_id || '');
    const title = stripHtml(item.title || item.product_title || item.desc || '');
    const description = stripHtml(item.description || item.desc || item.caption || title || '');
    const sourceUrl = item.source_url || item.url || item.share_url || (platformContentId ? `https://www.douyin.com/video/${platformContentId}` : '');
    const publishTime = Number(
      item.publish_time
      || item.publishTime
      || item.create_time
      || item.createTime
      || 0
    ) || null;

    return {
      platform: 'douyin',
      platform_content_id: platformContentId,
      content_type: item.content_type || item.contentType || 'video',
      title,
      description,
      author_id: String(item.author_id || author.id || author.uid || author.sec_uid || ''),
      author_name: String(item.author_name || author.name || author.nickname || ''),
      author_avatar: item.author_avatar || author.avatar || author.avatar_url || '',
      cover_url: item.cover_url || item.cover || item.coverUrl || item.image || '',
      source_url: sourceUrl,
      play_url: item.play_url || item.video_url || item.playUrl || '',
      publish_time: publishTime,
      liked_count: sanitizeNumber(item.liked_count ?? item.like_count ?? item.likes ?? stats.likes),
      comment_count: sanitizeNumber(item.comment_count ?? item.comments ?? stats.comments),
      share_count: sanitizeNumber(item.share_count ?? item.shares ?? stats.shares),
      favorite_count: sanitizeNumber(item.favorite_count ?? item.collect_count ?? item.favorites ?? stats.favorites),
      view_count: sanitizeNumber(item.view_count ?? item.play_count ?? item.views ?? stats.views),
      source_keyword: keyword || item.source_keyword || item.keyword || '',
      raw_payload: item.raw_payload || item
    };
  }

  validateItem(item) {
    if (!item.platform_content_id) return false;
    if (!item.source_url && !item.play_url) return false;
    return true;
  }

  createRequestPayload({ keywords = [], limit = 10 } = {}) {
    const normalizedKeywords = keywords.map(item => String(item || '').trim()).filter(Boolean);
    const numericLimit = Math.max(1, Number(limit || 10));
    const effectivePerKeywordLimit = Math.max(
      1,
      Math.min(
        this.resultLimitPerKeyword,
        Math.ceil(numericLimit / Math.max(1, normalizedKeywords.length)) + 1
      )
    );

    return {
      platform: 'douyin',
      task: this.taskName,
      session_profile: this.sessionProfile,
      keywords: normalizedKeywords,
      limit: numericLimit,
      result_limit_per_keyword: effectivePerKeywordLimit,
      timeout_ms: this.timeoutMs
    };
  }

  extractItemsFromBridgeResult(result, fallbackKeywords = []) {
    const rawItems = Array.isArray(result.items)
      ? result.items
      : (Array.isArray(result.data?.items) ? result.data.items : []);
    const items = [];

    for (const rawItem of rawItems) {
      const fallbackKeyword = rawItem?.source_keyword || rawItem?.keyword || fallbackKeywords[0] || '';
      const item = this.normalizeItem(rawItem, fallbackKeyword);
      if (!this.validateItem(item)) {
        console.warn(`[douyin-agent] skip invalid item contentId=${item.platform_content_id || '-'} sourceKeyword=${item.source_keyword || '-'}`);
        continue;
      }
      items.push(item);
    }

    return items;
  }

  async collect({ keywords = [], limit = 10 } = {}) {
    const normalizedKeywords = keywords.map(item => String(item || '').trim()).filter(Boolean);
    if (normalizedKeywords.length === 0) {
      throw new Error('抖音 agent 采集缺少关键词');
    }
    const numericLimit = Math.max(1, Number(limit || 10));
    const keywordChunks = chunkArray(normalizedKeywords, this.keywordBatchSize);
    const dedup = new Map();
    console.log(`[douyin-agent] collect start keywordCount=${normalizedKeywords.length} limit=${numericLimit} keywordBatchSize=${this.keywordBatchSize} batchLimit=${this.batchLimit} bridgeTask=${this.taskName} taskTimeoutMs=${this.timeoutMs} bridgeTimeoutMs=${this.bridgeTimeoutMs}`);

    for (let index = 0; index < keywordChunks.length; index += 1) {
      const keywordBatch = keywordChunks[index];
      const remaining = numericLimit - dedup.size;
      if (remaining <= 0) break;

      const payload = this.createRequestPayload({
        keywords: keywordBatch,
        limit: Math.min(this.batchLimit, remaining)
      });
      console.log(`[douyin-agent] batch start index=${index + 1}/${keywordChunks.length} keywords=${keywordBatch.join(',')} batchLimit=${payload.limit} perKeyword=${payload.result_limit_per_keyword}`);
      const result = await this.client.crawlDouyin(payload);
      if (!result || result.success === false) {
        const code = result?.code ? ` code=${result.code}` : '';
        console.error(`[douyin-agent] bridge returned failure${code} message=${result?.message || 'unknown error'} batch=${index + 1}`);
        throw new Error(`douyin agent collect failed${code} message=${result?.message || 'unknown error'}`);
      }

      const items = this.extractItemsFromBridgeResult(result, keywordBatch);
      console.log(`[douyin-agent] batch success index=${index + 1}/${keywordChunks.length} rawItemCount=${items.length}`);

      for (const item of items) {
        const dedupKey = `douyin:${item.platform_content_id}`;
        if (dedup.has(dedupKey)) continue;
        dedup.set(dedupKey, item);
        if (dedup.size >= numericLimit) break;
      }

      if (index < keywordChunks.length - 1 && dedup.size < numericLimit && this.batchDelayMs > 0) {
        await sleep(this.batchDelayMs);
      }
    }

    const items = Array.from(dedup.values()).slice(0, numericLimit);
    console.log(`[douyin-agent] collect done count=${items.length} sample=${items[0]?.platform_content_id || '-'}`);
    return items;
  }
}

module.exports = DouyinAgentCollector;

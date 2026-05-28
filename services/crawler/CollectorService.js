const SourceContentItem = require('../../models/SourceContentItem');
const CollectionRunLog = require('../../models/CollectionRunLog');
const CommercialKeyword = require('../../models/CommercialKeyword');
const BilibiliCollector = require('./platforms/BilibiliCollector');
const DouyinCollector = require('./platforms/DouyinCollector');
const DouyinAgentCollector = require('./platforms/DouyinAgentCollector');
const { getBaseCollectorOptions, resolveRunInput, normalizeKeywords } = require('./CrawlerConfig');

/**
 * 采集服务统一入口。
 * 负责按平台创建采集器、选择关键词、写入内容表，并更新采集运行日志。
 */
class CollectorService {
  constructor() {
    this.collectors = {
      bilibili: options => new BilibiliCollector(options),
      douyin: options => this.createDouyinCollector(options)
    };
  }

  createDouyinCollector(options = {}) {
    const mode = String(options.collectorMode || 'playwright').trim().toLowerCase();
    if (mode === 'agent') {
      return new DouyinAgentCollector(options);
    }
    return new DouyinCollector(options);
  }

  /**
   * 返回当前支持的采集平台列表。
   */
  getSupportedPlatforms() {
    return Object.keys(this.collectors);
  }

  /**
   * 根据平台名创建具体采集器实例。
   */
  createCollector(platform, options = {}) {
    const factory = this.collectors[platform];
    if (!factory) {
      throw new Error(`不支持的平台: ${platform}`);
    }
    return factory({
      ...getBaseCollectorOptions(platform),
      ...options
    });
  }

  /**
   * 执行一次“采集并入库”任务。
   * 如果调用方未显式传关键词，会自动从商业关键词池选词。
   */
  async collectAndStore({ platform, keywords, limit = 10, options = {} } = {}) {
    const resolvedInput = resolveRunInput({
      platform,
      keywords,
      limit,
      options
    });
    let normalizedKeywords = normalizeKeywords(resolvedInput.keywords);
    if (!resolvedInput.platform) {
      throw new Error('缺少 platform 参数');
    }
    console.log(`[collector] collectAndStore start platform=${resolvedInput.platform} limit=${resolvedInput.limit} inputKeywords=${normalizedKeywords.join(',') || '-'}`);

    if (normalizedKeywords.length === 0) {
      const keywordPool = await CommercialKeyword.pickForCollection({
        platform: resolvedInput.platform,
        limit: Math.max(1, Math.min(Number(resolvedInput.options?.keywordPoolLimit || 5), 20))
      });
      normalizedKeywords = keywordPool.map(item => item.keyword);
      console.log(`[collector] keyword-pool fallback platform=${resolvedInput.platform} count=${normalizedKeywords.length} keywords=${normalizedKeywords.join(',') || '-'}`);
    }

    if (normalizedKeywords.length === 0) {
      throw new Error('至少提供一个关键词，或者先导入并分析热点词生成商业关键词池');
    }

    const collector = this.createCollector(resolvedInput.platform, resolvedInput.options);
    const runId = await CollectionRunLog.create({
      platform: resolvedInput.platform,
      keywords: normalizedKeywords.join(','),
      limit: resolvedInput.limit
    });
    console.log(`[collector] run created runId=${runId} platform=${resolvedInput.platform} keywordCount=${normalizedKeywords.length}`);
    const attemptedCount = await CommercialKeyword.markAttemptedByKeywords(
      normalizedKeywords,
      resolvedInput.platform,
      'running'
    );
    console.log(`[collector] keyword usage attempted runId=${runId} platform=${resolvedInput.platform} count=${attemptedCount}`);

    try {
      const items = await collector.collect({
        keywords: normalizedKeywords,
        limit: Number(resolvedInput.limit || 10)
      });
      console.log(`[collector] collect raw result runId=${runId} platform=${resolvedInput.platform} count=${items.length}`);
      if (items.length > 0) {
        console.log(`[collector] collect sample runId=${runId} first=${items[0].platform_content_id} title=${String(items[0].title || '').slice(0, 50)}`);
      }

      await SourceContentItem.upsertMany(items);
      console.log(`[collector] db upsert done runId=${runId} platform=${resolvedInput.platform} count=${items.length}`);
      const markedCount = await CommercialKeyword.markCollectedByKeywords(normalizedKeywords, resolvedInput.platform);
      console.log(`[collector] keyword usage marked runId=${runId} platform=${resolvedInput.platform} count=${markedCount}`);
      await CollectionRunLog.finish(runId, {
        status: 'success',
        collected_count: items.length
      });
      console.log(`[collector] run finished runId=${runId} status=success collected=${items.length}`);

      return {
        runId,
        platform: resolvedInput.platform,
        keywords: normalizedKeywords,
        count: items.length,
        items
      };
    } catch (error) {
      console.error(`[collector] run failed runId=${runId} platform=${resolvedInput.platform} error=${error.message}`);
      await CommercialKeyword.markAttemptedByKeywords(normalizedKeywords, resolvedInput.platform, 'failed');
      await CollectionRunLog.finish(runId, {
        status: 'failed',
        collected_count: 0,
        error_message: error.message
      });
      throw error;
    }
  }
}

module.exports = new CollectorService();

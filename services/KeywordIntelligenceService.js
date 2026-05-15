const TrendingKeyword = require('../models/TrendingKeyword');
const KeywordAnalysisResult = require('../models/KeywordAnalysisResult');
const CommercialKeyword = require('../models/CommercialKeyword');
const LLM = require('./LLMService');
const Prompt = require('./PromptService');
const HotlistService = require('./HotlistService');

function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function ensureStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function chunkArray(items, size) {
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

/**
 * 热点词智能筛选服务。
 * 负责导入热榜、调用 LLM 判断商业价值、并把可用词沉淀到商业关键词池。
 */
class KeywordIntelligenceService {
  /**
   * 返回当前批量筛词大小。
   * 默认每批 10 个关键词，可通过环境变量覆盖。
   */
  getBatchSize() {
    return Math.max(1, Math.min(Number(process.env.KEYWORD_FILTER_BATCH_SIZE || 10), 20));
  }

  /**
   * 把一批原始热点词写入 trending_keywords。
   */
  async importTrendingKeywords({ source = 'manual', keywords = [], snapshotTime = null } = {}) {
    console.log(`[keywords] import start source=${source} count=${Array.isArray(keywords) ? keywords.length : 0} snapshotTime=${snapshotTime || '-'}`);
    const ids = await TrendingKeyword.createMany({ source, keywords, snapshotTime });
    console.log(`[keywords] import done source=${source} inserted=${ids.length}`);
    return {
      source,
      count: ids.length,
      ids
    };
  }

  /**
   * 从外部热榜接口拉取指定 type 的数据，并按需继续做 AI 商业筛词。
   */
  async syncFromHotlist({ type, limit = 20, analyze = false } = {}) {
    console.log(`[keywords] hotlist fetch start type=${type} limit=${limit} analyze=${analyze}`);
    const payload = await HotlistService.fetchHotlist(type);
    const source = HotlistService.normalizeSource(type);
    const keywords = HotlistService.normalizeKeywords(payload, type, limit);
    console.log(`[keywords] hotlist fetch done type=${type} source=${source} rawCount=${Array.isArray(payload?.data) ? payload.data.length : 0} normalizedCount=${keywords.length}`);

    const imported = await this.importTrendingKeywords({
      source,
      keywords,
      snapshotTime: payload?.update_time || null
    });

    let analyzedItems = [];
    if (analyze && imported.ids.length > 0) {
      console.log(`[keywords] analyze start source=${source} ids=${imported.ids.length}`);
      analyzedItems = await this.analyzePending({
        ids: imported.ids,
        limit: imported.ids.length
      });
      console.log(`[keywords] analyze done source=${source} resultCount=${analyzedItems.length}`);
    }

    return {
      source,
      type,
      title: payload?.title || '',
      subtitle: payload?.subtitle || '',
      update_time: payload?.update_time || null,
      imported_count: imported.count,
      imported_ids: imported.ids,
      analyzed_count: analyzedItems.length,
      analyzed_items: analyzedItems
    };
  }

  /**
   * 获取待分析热词，并按批次调用大模型完成商业价值判断。
   */
  async analyzePending({ limit = 20, ids = [] } = {}) {
    const items = await TrendingKeyword.getPending({ limit, ids });
    console.log(`[keywords] analyze-pending fetched=${items.length} limit=${limit} idsFilter=${Array.isArray(ids) ? ids.length : 0}`);
    const results = [];

    const chunks = chunkArray(items, this.getBatchSize());
    for (const batch of chunks) {
      const batchResults = await this.analyzeBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 对一批热词做批量 AI 分析。
   * 若批量返回格式异常，会自动回退到单条分析，保证流程可继续。
   */
  async analyzeBatch(items = []) {
    if (!Array.isArray(items) || items.length === 0) return [];
    console.log(`[keywords] analyze-batch start size=${items.length}`);
    const promptText = Prompt.buildKeywordBatchFilterPrompt({ keywordItems: items });

    try {
      const content = await LLM.chatJson({
        task: 'keyword_filter',
        user: promptText,
        responseFormat: null
      });
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        parsed = null;
      }

      if (!Array.isArray(parsed) || parsed.length !== items.length) {
        throw new Error(`批量关键词分析返回格式异常，expected=${items.length} actual=${Array.isArray(parsed) ? parsed.length : 'invalid'}`);
      }

      const results = [];
      for (let index = 0; index < items.length; index += 1) {
        results.push(await this.persistAnalysis(items[index], parsed[index] || {}));
      }
      console.log(`[keywords] analyze-batch done size=${items.length}`);
      return results;
    } catch (error) {
      console.warn(`[keywords] analyze-batch fallback size=${items.length} error=${error.message}`);
      const results = [];
      for (const item of items) {
        try {
          results.push(await this.analyzeSingle(item));
        } catch (singleError) {
          results.push({
            trending_keyword_id: item.id,
            keyword: item.keyword,
            is_commercial: false,
            confidence: 0,
            expanded_keywords: [],
            recommended_platforms: [],
            commercial_keywords: [],
            error: singleError.message
          });
        }
      }
      return results;
    }
  }

  /**
   * 对单个热词做 AI 商业分析。
   * 这个方法既可独立使用，也作为批量失败时的回退路径。
   */
  async analyzeSingle(item) {
    console.log(`[keywords] analyze-single start id=${item.id} keyword=${item.keyword} source=${item.source}`);
    const promptText = Prompt.buildKeywordFilterPrompt({ keywordItem: item });
    const content = await LLM.chatJson({
      task: 'keyword_filter',
      user: promptText,
      responseFormat: 'json_object'
    });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      parsed = {
        is_commercial: false,
        confidence: 0,
        category: '',
        intent_type: 'none',
        reason: '模型返回格式无法解析',
        expanded_keywords: [],
        recommended_platforms: []
      };
    }

    return this.persistAnalysis(item, parsed);
  }

  /**
   * 持久化单个热词的分析结果。
   * 会同时写入分析记录表，并在有价值时 upsert 到商业关键词池。
   */
  async persistAnalysis(item, parsed = {}) {
    const isCommercial = parsed.is_commercial === true;
    const confidence = normalizeConfidence(parsed.confidence);
    const expandedKeywords = ensureStringArray(parsed.expanded_keywords);
    const recommendedPlatforms = ensureStringArray(parsed.recommended_platforms)
      .filter(platform => ['douyin', 'bilibili'].includes(platform));
    const commercialKeywords = [];

    if (isCommercial) {
      const mergedKeywords = Array.from(new Set([item.keyword, ...expandedKeywords]));

      for (const keyword of mergedKeywords) {
        commercialKeywords.push({
          keyword,
          source_keyword_id: item.id,
          source: item.source,
          category: parsed.category || '',
          priority: Math.round(confidence * 100),
          platforms: recommendedPlatforms.length > 0 ? recommendedPlatforms : ['douyin', 'bilibili'],
          confidence,
          reason: parsed.reason || '',
          status: 'active'
        });
      }
    }

    const analysisId = await KeywordAnalysisResult.create({
      trending_keyword_id: item.id,
      model_name: LLM.getModelName('keyword_filter'),
      is_commercial: isCommercial,
      confidence,
      suggested_category: parsed.category || '',
      intent_type: parsed.intent_type || 'none',
      expanded_keywords: expandedKeywords,
      recommended_platforms: recommendedPlatforms,
      reason: parsed.reason || '',
      raw_response: parsed
    });

    if (commercialKeywords.length > 0) {
      await CommercialKeyword.upsertMany(commercialKeywords);
      await TrendingKeyword.updateStatus(item.id, 'analyzed');
      console.log(`[keywords] analyze-single kept id=${item.id} keyword=${item.keyword} confidence=${confidence} commercialCount=${commercialKeywords.length} platforms=${recommendedPlatforms.join(',') || 'douyin,bilibili'}`);
    } else {
      await TrendingKeyword.updateStatus(item.id, 'discarded');
      console.log(`[keywords] analyze-single discarded id=${item.id} keyword=${item.keyword} confidence=${confidence}`);
    }

    return {
      trending_keyword_id: item.id,
      analysis_id: analysisId,
      keyword: item.keyword,
      is_commercial: isCommercial,
      confidence,
      expanded_keywords: expandedKeywords,
      recommended_platforms: recommendedPlatforms,
      commercial_keywords: commercialKeywords.map(entry => entry.keyword)
    };
  }
}

module.exports = new KeywordIntelligenceService();

const KeywordIntelligenceService = require('./KeywordIntelligenceService');
const CollectorService = require('./crawler/CollectorService');
const ContentAnalysisService = require('./ContentAnalysisService');
const SystemConfig = require('../models/SystemConfig');
const CommercialKeyword = require('../models/CommercialKeyword');
const HotlistRefreshGuard = require('./HotlistRefreshGuard');

const ALLOWED_HOTLIST_TYPES = ['douyin', 'weibo', 'zhihu'];
const DEFAULT_HOTLIST_LIMIT = 20;

function uniqueKeywords(items = []) {
  return Array.from(new Set(items.map(item => String(item || '').trim()).filter(Boolean)));
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, Number(num) || min));
}

function previewKeywords(keywords = [], limit = 8) {
  return keywords.slice(0, limit).join(', ');
}

function sumHotlistRuns(platformRuns = [], field) {
  return platformRuns.reduce((sum, run) => {
    return sum + Number(run?.result?.[field] || 0);
  }, 0);
}

function getCollectionKeywordLimit(productCount) {
  return clamp(Math.max(3, Math.ceil(Number(productCount || 1) / 2)), 3, 12);
}

function getHotlistTypes() {
  return [...ALLOWED_HOTLIST_TYPES];
}

/**
 * 工作台编排服务。
 * 现在只保留两类正式任务：
 * 1. refreshKeywordPool：刷新热点池并沉淀商业关键词
 * 2. runCollectionPipeline：消费商业关键词池执行采集、分析、候选生成
 */
class WorkbenchPipelineService {
  resolveContext({ mode = 'manual', platforms = null, productCount = null, hotlistLimit = null } = {}) {
    const resolvedMode = mode === 'scheduled' ? 'scheduled' : 'manual';
    return SystemConfig.getAIWorkbenchConfig().then(aiConfig => {
      const configuredPlatforms = resolvedMode === 'scheduled'
        ? (aiConfig?.scheduledTask?.platforms || [])
        : (aiConfig?.manualTrigger?.platforms || []);
      const selectedPlatforms = (Array.isArray(platforms) && platforms.length > 0 ? platforms : configuredPlatforms)
        .filter(platform => ['douyin', 'bilibili'].includes(platform));
      const finalProductCount = clamp(
        productCount || (resolvedMode === 'scheduled'
          ? aiConfig?.scheduledTask?.productCount
          : aiConfig?.manualTrigger?.productCount),
        1,
        50
      );
      const finalHotlistLimit = clamp(hotlistLimit || Math.max(finalProductCount * 2, 10), 1, 50);
      const collectKeywordLimit = getCollectionKeywordLimit(finalProductCount);

      return {
        aiConfig,
        resolvedMode,
        selectedPlatforms,
        finalProductCount,
        finalHotlistLimit,
        collectKeywordLimit
      };
    });
  }

  async refreshKeywordPool({ hotlistLimit = null } = {}) {
    const finalHotlistLimit = clamp(hotlistLimit || Number(process.env.HOTLIST_REFRESH_LIMIT || DEFAULT_HOTLIST_LIMIT), 1, 50);
    const hotlistTypes = getHotlistTypes();

    console.log(`[keyword-pool] refresh start hotlistTypes=${hotlistTypes.join(',')} hotlistLimit=${finalHotlistLimit}`);
    const hotlistRuns = [];

    for (const type of hotlistTypes) {
      try {
        const guardResult = await HotlistRefreshGuard.run(type, async () => {
          console.log(`[keyword-pool] sync-hotlist start type=${type}`);
          return KeywordIntelligenceService.syncFromHotlist({
            type,
            limit: finalHotlistLimit,
            analyze: true
          });
        });

        if (guardResult.status === 'executed' || guardResult.status === 'joined') {
          const result = guardResult.result;
          console.log(`[keyword-pool] sync-hotlist done type=${type} imported=${result.imported_count} analyzed=${result.analyzed_count} guard=${guardResult.status}`);
          hotlistRuns.push({
            type,
            guardStatus: guardResult.status,
            result
          });
        } else {
          hotlistRuns.push({
            type,
            guardStatus: guardResult.status,
            result: null,
            remainingMs: guardResult.remainingMs
          });
        }
      } catch (error) {
        console.error(`[keyword-pool] sync-hotlist failed type=${type} error=${error.message}`);
        hotlistRuns.push({
          type,
          guardStatus: 'failed',
          result: null,
          error: error.message
        });
      }
    }

    const poolAfter = await CommercialKeyword.getPoolStats();
    const availableCount = await CommercialKeyword.getAvailableCount();

    const result = {
      mode: 'scheduled_keyword_refresh',
      hotlist_types: hotlistTypes,
      hotlist_limit: finalHotlistLimit,
      summary: {
        hotlist_imported_count: sumHotlistRuns(hotlistRuns, 'imported_count'),
        hotlist_analyzed_count: sumHotlistRuns(hotlistRuns, 'analyzed_count')
      },
      hotlist_runs: hotlistRuns,
      pool_after: {
        ...poolAfter,
        availableCount
      }
    };
    console.log(`[keyword-pool] refresh done imported=${result.summary.hotlist_imported_count} analyzed=${result.summary.hotlist_analyzed_count}`);
    return result;
  }

  async runCollectionPipeline({ mode = 'manual', platforms = null, productCount = null } = {}) {
    const {
      resolvedMode,
      selectedPlatforms,
      finalProductCount,
      collectKeywordLimit
    } = await this.resolveContext({
      mode,
      platforms,
      productCount,
      hotlistLimit: null
    });

    if (selectedPlatforms.length === 0) {
      throw new Error('未配置可执行的平台，请先在工作台设置中选择抖音或B站');
    }

    console.log(`[collection-pipeline] start mode=${resolvedMode} platforms=${selectedPlatforms.join(',')} productCount=${finalProductCount} collectKeywordLimit=${collectKeywordLimit}`);
    const platformRuns = [];
    const warnings = [];

    for (const platform of selectedPlatforms) {
      try {
        const poolBefore = await CommercialKeyword.getPoolStats({ platform });
        const availableCount = await CommercialKeyword.getAvailableCount({ platform });
        console.log(`[collection-pipeline] keyword-pool before platform=${platform} total=${poolBefore.totalCount} unused=${poolBefore.unusedCount} used=${poolBefore.usedCount} available=${availableCount}`);

        if (availableCount < collectKeywordLimit) {
          const warning = {
            code: 'insufficient_keyword_pool',
            platform,
            available_count: availableCount,
            required_count: collectKeywordLimit,
            message: `平台 ${platform} 当前可用商业关键词不足（可用 ${availableCount} 个，至少需要 ${collectKeywordLimit} 个），请等待下一次热点池刷新后再试`
          };
          warnings.push(warning);
          console.warn(`[collection-pipeline] skip collect platform=${platform} reason=insufficient-keyword-pool available=${availableCount} required=${collectKeywordLimit}`);
          platformRuns.push({
            platform,
            success: true,
            pool_before: poolBefore,
            collect: null,
            skipped: true,
            warning
          });
          continue;
        }

        const keywordRows = await CommercialKeyword.pickForCollection({
          platform,
          limit: collectKeywordLimit
        });
        const collectionKeywords = uniqueKeywords(keywordRows.map(item => item.keyword));
        console.log(`[collection-pipeline] collect-keywords platform=${platform} count=${collectionKeywords.length} preview=${previewKeywords(collectionKeywords) || '-'} keywordIds=${keywordRows.map(item => item.id).slice(0, 8).join(',') || '-'}`);

        if (collectionKeywords.length === 0) {
          console.warn(`[collection-pipeline] skip collect platform=${platform} reason=no-keywords-in-pool`);
          platformRuns.push({
            platform,
            success: true,
            collect: null,
            skipped: true,
            message: '当前商业关键词池中没有可用关键词，已跳过本平台采集'
          });
          continue;
        }

        console.log(`[collection-pipeline] collect start platform=${platform} limit=${finalProductCount}`);
        const collect = await CollectorService.collectAndStore({
          platform,
          keywords: collectionKeywords,
          limit: finalProductCount
        });
        console.log(`[collection-pipeline] collect done platform=${platform} runId=${collect.runId} count=${collect.count}`);

        platformRuns.push({
          platform,
          success: true,
          pool_before: poolBefore,
          selected_keywords: collectionKeywords,
          collect
        });
      } catch (error) {
        console.error(`[collection-pipeline] platform failed platform=${platform} error=${error.message}`);
        platformRuns.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`[collection-pipeline] analysis start mode=${resolvedMode} platforms=${selectedPlatforms.join(',')} limit=${finalProductCount}`);
    const analysis = await ContentAnalysisService.analyzePending({
      mode: resolvedMode,
      limit: finalProductCount,
      platforms: selectedPlatforms
    });
    console.log(`[collection-pipeline] analysis done count=${analysis?.count || 0} createdCandidates=${analysis?.createdCandidates || 0}`);

    const result = {
      mode: resolvedMode,
      platforms: selectedPlatforms,
      product_count: finalProductCount,
      warnings,
      summary: {
        crawled_count: platformRuns.reduce((sum, item) => sum + Number(item?.collect?.count || 0), 0),
        analyzed_content_count: Number(analysis?.count || 0),
        created_candidates_count: Number(analysis?.createdCandidates || 0)
      },
      platform_runs: platformRuns,
      analysis
    };

    if (resolvedMode === 'manual' && result.summary.crawled_count === 0 && warnings.length > 0) {
      const error = new Error(warnings[0].message);
      error.statusCode = 400;
      error.code = warnings[0].code;
      error.details = warnings[0];
      throw error;
    }

    console.log(`[collection-pipeline] done crawled=${result.summary.crawled_count} analyzed=${result.summary.analyzed_content_count} candidates=${result.summary.created_candidates_count}`);
    return result;
  }

}

module.exports = new WorkbenchPipelineService();

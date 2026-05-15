const KeywordIntelligenceService = require('./KeywordIntelligenceService');
const CollectorService = require('./crawler/CollectorService');
const ContentAnalysisService = require('./ContentAnalysisService');
const SystemConfig = require('../models/SystemConfig');
const CommercialKeyword = require('../models/CommercialKeyword');
const HotlistRefreshGuard = require('./HotlistRefreshGuard');

const DEFAULT_HOTLIST_TYPES_BY_PLATFORM = {
  douyin: ['douyin', 'weibo', 'zhihu', 'baidu'],
  bilibili: ['biliall', 'bilihot', 'weibo', 'zhihu', 'baidu']
};

function uniqueKeywords(items = []) {
  return Array.from(new Set(items.map(item => String(item || '').trim()).filter(Boolean)));
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, Number(num) || min));
}

function previewKeywords(keywords = [], limit = 8) {
  return keywords.slice(0, limit).join(', ');
}

function getCollectionKeywordLimit(productCount) {
  return clamp(Math.max(3, Math.ceil(Number(productCount || 1) / 2)), 3, 12);
}

function getHotlistTypesForPlatform(platform) {
  const envKey = `HOTLIST_SOURCE_TYPES_${String(platform || '').toUpperCase()}`;
  const fromEnv = String(process.env[envKey] || '').split(',').map(item => item.trim()).filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return DEFAULT_HOTLIST_TYPES_BY_PLATFORM[platform] || [];
}

/**
 * 工作台总编排服务。
 * 负责把“词池检查、按需补热词、平台采集、内容分析”串成一次完整流水线。
 */
class WorkbenchPipelineService {
  /**
   * 执行一次 AI 选品主流程。
   * 定时模式每天固定补热词，手动模式则优先消费现有词池，不足时再补热词。
   */
  async run({ mode = 'manual', platforms = null, productCount = null, hotlistLimit = null } = {}) {
    const resolvedMode = mode === 'scheduled' ? 'scheduled' : 'manual';
    const aiConfig = await SystemConfig.getAIWorkbenchConfig();
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

    if (selectedPlatforms.length === 0) {
      throw new Error('未配置可执行的平台，请先在工作台设置中选择抖音或B站');
    }

    console.log(`[pipeline] start mode=${resolvedMode} platforms=${selectedPlatforms.join(',')} productCount=${finalProductCount} hotlistLimit=${finalHotlistLimit} collectKeywordLimit=${collectKeywordLimit}`);
    const platformRuns = [];

    for (const platform of selectedPlatforms) {
      try {
        const poolBefore = await CommercialKeyword.getPoolStats({ platform });
        console.log(`[pipeline] keyword-pool before platform=${platform} total=${poolBefore.totalCount} unused=${poolBefore.unusedCount} used=${poolBefore.usedCount}`);

        const hotlistRuns = [];
        const shouldRefreshHotlist = resolvedMode === 'scheduled' || poolBefore.totalCount < collectKeywordLimit;
        if (shouldRefreshHotlist) {
          const hotlistTypes = getHotlistTypesForPlatform(platform);
          const refreshReason = resolvedMode === 'scheduled'
            ? 'scheduled-daily-refresh'
            : `pool-insufficient need=${collectKeywordLimit}`;
          console.log(`[pipeline] hotlist refresh platform=${platform} reason=${refreshReason} hotlistTypes=${hotlistTypes.join(',') || '-'}`);
          for (const type of hotlistTypes) {
            const guardResult = await HotlistRefreshGuard.run(type, async () => {
              console.log(`[pipeline] sync-hotlist start platform=${platform} type=${type}`);
              return KeywordIntelligenceService.syncFromHotlist({
                type,
                limit: finalHotlistLimit,
                analyze: true
              });
            });

            if (guardResult.status === 'executed' || guardResult.status === 'joined') {
              const hotlist = guardResult.result;
              console.log(`[pipeline] sync-hotlist done platform=${platform} type=${type} imported=${hotlist.imported_count} analyzed=${hotlist.analyzed_count} guard=${guardResult.status}`);
              hotlistRuns.push({
                type,
                guardStatus: guardResult.status,
                hotlist
              });
            } else {
              hotlistRuns.push({
                type,
                guardStatus: guardResult.status,
                hotlist: null,
                remainingMs: guardResult.remainingMs
              });
            }

            const poolCurrent = await CommercialKeyword.getPoolStats({ platform });
            console.log(`[pipeline] keyword-pool after-refresh-check platform=${platform} total=${poolCurrent.totalCount} unused=${poolCurrent.unusedCount} used=${poolCurrent.usedCount}`);
            if (resolvedMode !== 'scheduled' && poolCurrent.totalCount >= collectKeywordLimit) {
              break;
            }
          }
        } else {
          console.log(`[pipeline] skip hotlist refresh platform=${platform} reason=pool-sufficient`);
        }

        const keywordRows = await CommercialKeyword.pickForCollection({
          platform,
          limit: collectKeywordLimit
        });
        const collectionKeywords = uniqueKeywords(keywordRows.map(item => item.keyword));
        console.log(`[pipeline] collect-keywords platform=${platform} count=${collectionKeywords.length} preview=${previewKeywords(collectionKeywords) || '-'} keywordIds=${keywordRows.map(item => item.id).slice(0, 8).join(',') || '-'}`);

        if (collectionKeywords.length === 0) {
          console.warn(`[pipeline] skip collect platform=${platform} reason=no-keywords-in-pool`);
          platformRuns.push({
            platform,
            success: true,
            hotlist_runs: hotlistRuns,
            collect: null,
            skipped: true,
            message: '当前商业关键词池中没有可用关键词，已跳过本平台采集'
          });
          continue;
        }

        console.log(`[pipeline] collect start platform=${platform} limit=${finalProductCount}`);
        const collect = await CollectorService.collectAndStore({
          platform,
          keywords: collectionKeywords,
          limit: finalProductCount
        });
        console.log(`[pipeline] collect done platform=${platform} runId=${collect.runId} count=${collect.count}`);

        platformRuns.push({
          platform,
          success: true,
          pool_before: poolBefore,
          hotlist_runs: hotlistRuns,
          selected_keywords: collectionKeywords,
          collect
        });
      } catch (error) {
        console.error(`[pipeline] platform failed platform=${platform} error=${error.message}`);
        platformRuns.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`[pipeline] analysis start mode=${resolvedMode} platforms=${selectedPlatforms.join(',')} limit=${finalProductCount}`);
    const analysis = await ContentAnalysisService.analyzePending({
      mode: resolvedMode,
      limit: finalProductCount,
      platforms: selectedPlatforms
    });
    console.log(`[pipeline] analysis done count=${analysis?.count || 0} createdCandidates=${analysis?.createdCandidates || 0}`);

    const result = {
      mode: resolvedMode,
      platforms: selectedPlatforms,
      hotlist_limit: finalHotlistLimit,
      product_count: finalProductCount,
      summary: {
        hotlist_imported_count: platformRuns.reduce((sum, item) => sum + Number(item?.hotlist?.imported_count || 0), 0),
        hotlist_analyzed_count: platformRuns.reduce((sum, item) => sum + Number(item?.hotlist?.analyzed_count || 0), 0),
        crawled_count: platformRuns.reduce((sum, item) => sum + Number(item?.collect?.count || 0), 0),
        analyzed_content_count: Number(analysis?.count || 0),
        created_candidates_count: Number(analysis?.createdCandidates || 0)
      },
      platform_runs: platformRuns,
      analysis
    };
    console.log(`[pipeline] done hotlistImported=${result.summary.hotlist_imported_count} hotlistAnalyzed=${result.summary.hotlist_analyzed_count} crawled=${result.summary.crawled_count} analyzed=${result.summary.analyzed_content_count} candidates=${result.summary.created_candidates_count}`);
    return result;
  }
}

module.exports = new WorkbenchPipelineService();

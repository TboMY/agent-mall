const Category = require('../models/Category');
const AIProductCandidate = require('../models/AIProductCandidate');
const SourceContentItem = require('../models/SourceContentItem');
const SystemConfig = require('../models/SystemConfig');
const LLM = require('./LLMService');
const Prompt = require('./PromptService');
const { calculateWeightedScore } = require('../utils/scoreCalculator');

function normalizeCounts(numLike) {
  const n = Number(numLike || 0);
  return Number.isFinite(n) ? n : 0;
}

function resolveMode(inputMode) {
  return inputMode === 'scheduled' ? 'scheduled' : 'manual';
}

/**
 * 平台内容分析服务。
 * 负责把 source_content_items 中待分析的内容送入大模型，并产出 AI 候选商品。
 */
class ContentAnalysisService {
  /**
   * 分析一批待处理内容。
   * 会根据 mode 读取工作台配置，并在分析完成后更新内容状态与候选商品表。
   */
  async analyzePending({ mode = 'manual', limit = null, platforms = null } = {}) {
    const resolvedMode = resolveMode(mode);
    const aiConfig = await SystemConfig.getAIWorkbenchConfig();
    const strategy = aiConfig?.aiModel?.recommendationStrategy || 'viral_priority';
    const configuredLimit = resolvedMode === 'scheduled'
      ? aiConfig?.scheduledTask?.productCount
      : aiConfig?.manualTrigger?.productCount;
    const configuredPlatforms = resolvedMode === 'scheduled'
      ? (aiConfig?.scheduledTask?.platforms || [])
      : (aiConfig?.manualTrigger?.platforms || []);

    const finalLimit = Math.max(1, Number(limit || configuredLimit || 5));
    const finalPlatforms = Array.isArray(platforms) && platforms.length > 0
      ? platforms
      : configuredPlatforms;
    const rows = await SourceContentItem.getPendingForAnalysis({
      platforms: finalPlatforms,
      limit: finalLimit
    });

    if (!rows || rows.length === 0) {
      return {
        success: true,
        mode: resolvedMode,
        platforms: finalPlatforms,
        limit: finalLimit,
        count: 0,
        createdCandidates: 0,
        results: []
      };
    }

    await SourceContentItem.markBatchProcessing(rows.map(row => row.id));

    const categories = await Category.getAll();
    const tags = [];
    const system = undefined;

    console.log(`开始AI分析（${resolvedMode === 'scheduled' ? '定时任务' : '手动触发'}），共 ${rows.length} 条内容`);

    const processItem = async aweme => {
      try {
        const promptText = Prompt.buildFullPromptForAweme({
          aweme,
          categoryOptions: categories,
          tags
        });
        const videoUrl = aweme.play_url;
        const content = videoUrl
          ? await LLM.chatWithVideo({
              system,
              text: promptText,
              videoUrl,
              responseFormat: 'json_object'
            })
          : await LLM.chatJson({
              system,
              user: promptText,
              responseFormat: 'json_object'
            });

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (error) {
          parsed = { is_valuable: false, product_info: {} };
        }

        let candidateId = null;
        if (parsed.is_valuable && parsed.product_info) {
          try {
            const hotScore = calculateWeightedScore({
              liked_count: normalizeCounts(aweme.liked_count),
              comment_count: normalizeCounts(aweme.comment_count),
              share_count: normalizeCounts(aweme.share_count),
              collected_count: normalizeCounts(aweme.favorite_count),
              create_time: aweme.publish_time
            }, strategy);

            const existingCandidate = await AIProductCandidate.getBySourceContentId(aweme.id);
            const nextCandidate = {
              aweme_id: aweme.platform === 'douyin' ? Number(aweme.platform_content_id) : null,
              source_content_id: aweme.id,
              source_platform: aweme.platform,
              platform_content_id: aweme.platform_content_id,
              content_type: aweme.content_type || 'video',
              product_name: parsed.product_info.name || aweme.title,
              product_category: parsed.product_info.category || '未分类',
              ai_reason: parsed.product_info.reason || parsed.reason || 'AI推荐商品',
              hot_score: hotScore,
              cover_url: aweme.cover_url,
              download_url: aweme.play_url,
              source_url: aweme.source_url,
              source_keyword: aweme.source_keyword || '',
              status: existingCandidate?.status === 1 ? 1 : 0
            };

            if (existingCandidate) {
              await AIProductCandidate.update(existingCandidate.id, nextCandidate);
              candidateId = existingCandidate.id;
            } else {
              candidateId = await AIProductCandidate.create(nextCandidate);
            }
          } catch (error) {
            console.error(`保存AI候选商品失败 (${aweme.platform}/${aweme.platform_content_id}):`, error);
          }
        }

        await SourceContentItem.updateAnalysisStatus(aweme.id, parsed.is_valuable ? 2 : 4, {
          error: null,
          setAnalyzedAt: true
        });

        return {
          content_id: aweme.id,
          platform: aweme.platform,
          platform_content_id: aweme.platform_content_id,
          is_valuable: parsed.is_valuable,
          candidate_id: candidateId
        };
      } catch (error) {
        await SourceContentItem.updateAnalysisStatus(aweme.id, 3, {
          error: error.message,
          setAnalyzedAt: true
        });
        console.error(`处理内容失败 (${aweme.platform}/${aweme.platform_content_id}):`, error);
        return {
          content_id: aweme.id,
          platform: aweme.platform,
          platform_content_id: aweme.platform_content_id,
          is_valuable: false,
          candidate_id: null,
          error: error.message
        };
      }
    };

    const results = await Promise.all(rows.map(processItem));
    const createdCandidates = results.filter(item => item.candidate_id).length;
    console.log(`AI分析完成，共处理 ${results.length} 条内容，成功创建 ${createdCandidates} 个候选商品`);

    return {
      success: true,
      mode: resolvedMode,
      platforms: finalPlatforms,
      limit: finalLimit,
      count: results.length,
      createdCandidates,
      results
    };
  }
}

module.exports = new ContentAnalysisService();

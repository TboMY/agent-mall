const { buildVideoAnalysisPrompt, buildKeywordFilterPrompt, buildKeywordBatchFilterPrompt } = require('../prompts/buildPrompt')
const { valuableVideoTemplate, commercialKeywordTemplate, commercialKeywordBatchTemplate } = require('../prompts/aiResponseTemplates')

/**
 * Prompt 组装服务。
 * 负责把数据库内容、分类信息和输出模板拼成可直接发送给大模型的提示词。
 */
class PromptService {
  constructor () {
    this.valuableVideoTemplate = valuableVideoTemplate
    this.commercialKeywordTemplate = commercialKeywordTemplate
    this.commercialKeywordBatchTemplate = commercialKeywordBatchTemplate
  }

  /**
   * 构建视频分析系统提示词的基础模板。
   */
  buildSystemPrompt ( { categoryOptions = [] } = {} ) {

    const videoData = {
      platform: '',
      title: '',
      desc: '',
      author_name: '',
      source_keyword: ''
    }

    return buildVideoAnalysisPrompt(videoData, categoryOptions,
      this.valuableVideoTemplate)
  }

  /**
   * 从统一内容对象中抽取视频分析所需的用户侧字段。
   */
  buildUserPromptFromAweme ( { aweme, tags = [] } ) {
    // 构建统一内容对象，兼容抖音/B站等不同平台
    const videoData = {
      platform: aweme?.platform || '',
      title: aweme?.title || '',
      desc: aweme?.description || aweme?.desc || '',
      author_name: aweme?.author_name || aweme?.nickname || '',
      source_keyword: aweme?.source_keyword || ''
    }

    return videoData
  }

  /**
   * 使用实际内容数据和分类信息生成完整的视频分析 Prompt。
   */
  buildFullPromptForAweme ({ aweme, categoryOptions = [], tags = [] }) {
    const videoData = this.buildUserPromptFromAweme({ aweme, tags })
    return buildVideoAnalysisPrompt(videoData, categoryOptions, this.valuableVideoTemplate)
  }

  /**
   * 生成单个热点词的商业价值分析 Prompt。
   */
  buildKeywordFilterPrompt ({ keywordItem }) {
    return buildKeywordFilterPrompt({
      keyword: keywordItem?.keyword || '',
      source: keywordItem?.source || '',
      raw_rank: keywordItem?.raw_rank || '',
      raw_score: keywordItem?.raw_score || '',
      snapshot_time: keywordItem?.snapshot_time || ''
    }, this.commercialKeywordTemplate)
  }

  /**
   * 生成批量热点词商业分析 Prompt。
   */
  buildKeywordBatchFilterPrompt({ keywordItems = [] }) {
    return buildKeywordBatchFilterPrompt(
      keywordItems.map(keywordItem => ({
        keyword: keywordItem?.keyword || '',
        source: keywordItem?.source || '',
        raw_rank: keywordItem?.raw_rank || '',
        raw_score: keywordItem?.raw_score || '',
        snapshot_time: keywordItem?.snapshot_time || ''
      })),
      this.commercialKeywordBatchTemplate
    )
  }
}

module.exports = new PromptService()



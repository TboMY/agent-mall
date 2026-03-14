const { buildVideoAnalysisPrompt } = require('../prompts/buildPrompt')
const { valuableVideoTemplate } = require('../prompts/aiResponseTemplates')

class PromptService {
  constructor () {
    this.valuableVideoTemplate = valuableVideoTemplate
  }

  buildSystemPrompt ( { categoryOptions = [] } = {} ) {

    const videoData = {
      title: '',
      desc: '',
      source_keyword: ''
    }

    return buildVideoAnalysisPrompt(videoData, categoryOptions,
      this.valuableVideoTemplate)
  }

  buildUserPromptFromAweme ( { aweme, tags = [] } ) {
    // 构建视频数据对象，直接使用数据库字段
    const videoData = {
      title: aweme?.title || '',
      desc: aweme?.desc || '',
      source_keyword: aweme?.source_keyword || '',
    }

    return videoData
  }

  // 使用实际数据库数据与分类，生成完整可发送到大模型的 Prompt 文本
  buildFullPromptForAweme ({ aweme, categoryOptions = [], tags = [] }) {
    const videoData = this.buildUserPromptFromAweme({ aweme, tags })
    return buildVideoAnalysisPrompt(videoData, categoryOptions, this.valuableVideoTemplate)
  }
}

module.exports = new PromptService()



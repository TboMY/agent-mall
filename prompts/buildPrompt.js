// videoAnalysisPromptBuilder.js

/**
 * 从视频描述中提取关键词（#开头的标签）
 */

/**
 * 构建用于大模型分析的完整 Prompt
 * @param {Object} videoData - 来自 douyin_aweme 表的一行数据
 * @param {string[]} categories - 商品分类列表（从商城数据库动态获取）
 * @param {Object} outputExample - 输出示例（如 valuableVideoTemplate）
 * @returns {string} 完整的 Prompt 字符串
 */
function buildVideoAnalysisPrompt ( videoData, categories, outputExample ) {

  const template = `
你是一个专业的电商选品分析师，你的任务是从提供的抖音视频信息中，判断该视频是否包含值得推荐的、有潜在商业价值的商品，并提取相关商品信息。

请仔细阅读以下视频信息：
- 视频标题: ${ videoData.title || '' }
- 视频描述/文案: ${ videoData.desc || '' }
- 关键词: ${ videoData.source_keyword }

你的工作流程如下：
1. **视频价值判断**: 首先，判断这个视频的主要目的是否是“推销”、“展示”、“分享”某个具体的、可购买的商品（例如：服装、美妆、电子产品、食品、小玩具、日常实用工具等）。纯粹的搞笑、才艺表演、知识科普、风景记录等非商品导向的内容，不属于有价值的视频。
   - 判断标准：视频内容是否聚焦于某个具体物品？是否在展示其功能、外观、使用场景？
2. **商品信息提取**: 如果视频有价值，请尝试提取出其中的核心商品信息。如果视频中没有明确指向的商品，或者商品信息模糊不清，按照无价值处理。
   - 商品名称: 尽可能准确地描述视频中展示的核心商品（例如：“蓝色比基尼泳装”、“三亚度假风连衣裙”、“某品牌防晒霜”）。如果无法确定具体名称，你拟定一个合适的商品名。
   - 推荐理由: 用一段话概括为什么这个商品值得关注或有潜力（例如：“符合夏日海边穿搭潮流”、“设计独特，容易引发用户共鸣”、“与热门话题#三亚 关联度高”），不超过60字。
   - 商品分类: 给出一个最合适的商品大类的id。必须从以下分类中选择一个分类，然后返回你选择的那个分类的id：
${ categories.map(c => `     - ${ c.id }: ${ c.name }`).join('\n') }

**输出要求**:
请严格按照JSON格式输出结果，不要包含任何额外的解释或文字。JSON对象必须包含以下字段：
- \`is_valuable\`: 布尔值。true 表示有价值，false 表示无价值。
- \`product_info\`: 对象。当 is_valuable 为 true 时，必须包含 name, reason, category；否则为空对象 {}。

**有价值输出示例**:
${ JSON.stringify(outputExample) }
  `.trim()

  // ${JSON.stringify(outputExample, null, 2)}

  return template
}

module.exports = {
  buildVideoAnalysisPrompt
}
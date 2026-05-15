// videoAnalysisPromptBuilder.js

/**
 * 从视频描述中提取关键词（#开头的标签）
 */

/**
 * 构建用于大模型分析的完整 Prompt
 * @param {Object} videoData - 来自 source_content_items 表的一行数据
 * @param {string[]} categories - 商品分类列表（从商城数据库动态获取）
 * @param {Object} outputExample - 输出示例（如 valuableVideoTemplate）
 * @returns {string} 完整的 Prompt 字符串
 */
function buildVideoAnalysisPrompt ( videoData, categories, outputExample ) {

  const template = `
你是一个专业的电商选品分析师，你的任务是从提供的平台内容信息中，判断该内容是否包含值得推荐的、有潜在商业价值的商品，并提取相关商品信息。

请仔细阅读以下内容信息：
- 来源平台: ${ videoData.platform || '' }
- 标题: ${ videoData.title || '' }
- 描述/文案: ${ videoData.desc || '' }
- 作者昵称: ${ videoData.author_name || '' }
- 关键词: ${ videoData.source_keyword }

你的工作流程如下：
1. **内容价值判断**: 首先，判断这个内容的主要目的是否是“推销”、“展示”、“分享”某个具体的、可购买的商品（例如：服装、美妆、电子产品、食品、小玩具、日常实用工具等）。纯粹的搞笑、才艺表演、知识科普、风景记录等非商品导向的内容，不属于有价值的内容。
   - 判断标准：内容是否聚焦于某个具体物品？是否在展示其功能、外观、使用场景？
2. **商品信息提取**: 如果内容有价值，请尝试提取出其中的核心商品信息。如果内容中没有明确指向的商品，或者商品信息模糊不清，按照无价值处理。
   - 商品名称: 尽可能准确地描述内容中展示的核心商品（例如：“蓝色比基尼泳装”、“三亚度假风连衣裙”、“某品牌防晒霜”）。如果无法确定具体名称，你拟定一个合适的商品名。
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

function buildKeywordFilterPrompt(keywordData, outputExample) {
  const template = `
你是一个电商选品系统中的“热点词商业价值分析器”。你的任务是判断一个热点词是否值得进入内容采集与选品流程。

请分析以下热点词：
- 关键词: ${keywordData.keyword || ''}
- 来源: ${keywordData.source || ''}
- 排名: ${keywordData.raw_rank || ''}
- 热度分值: ${keywordData.raw_score || ''}
- 抓取时间: ${keywordData.snapshot_time || ''}

判断标准：
1. 该词是否指向可购买的商品、消费需求、消费场景或可扩展商品话题。
2. 该词是否适合在抖音或B站搜索后找到与商品相关的内容。
3. 纯社会新闻、纯娱乐八卦、纯政策事件、纯赛事比分等一般判定为无商业意义。
4. 如果关键词本身较泛，但能稳定扩展为商品相关搜索词，也可判定为有商业意义。

输出要求：
请严格输出 JSON，不要带额外解释，字段必须包含：
- is_commercial: 布尔值
- confidence: 0 到 1 的数值
- category: 商品类目或消费方向，无商业价值时可填空字符串
- intent_type: 可选值为 product/category/scene/crowd/trend/none
- reason: 不超过80字的中文理由
- expanded_keywords: 数组，给出 0 到 5 个适合实际采集的搜索词
- recommended_platforms: 数组，可从 douyin、bilibili 中选择

输出示例：
${JSON.stringify(outputExample)}
  `.trim()

  return template
}

function buildKeywordBatchFilterPrompt(keywordItems, outputExample) {
  const items = Array.isArray(keywordItems) ? keywordItems : [];
  const template = `
你是一个电商选品系统中的“热点词商业价值分析器”。你的任务是批量判断一组热点词是否值得进入内容采集与选品流程。

请分析下面这些热点词。输出时请严格保持和输入相同的顺序，并且每个关键词输出一条结果。

热点词列表：
${items.map((item, index) => `- #${index + 1}
  keyword: ${item.keyword || ''}
  source: ${item.source || ''}
  raw_rank: ${item.raw_rank || ''}
  raw_score: ${item.raw_score || ''}
  snapshot_time: ${item.snapshot_time || ''}`).join('\n')}

判断标准：
1. 该词是否指向可购买的商品、消费需求、消费场景或可扩展商品话题。
2. 该词是否适合在抖音或B站搜索后找到与商品相关的内容。
3. 纯社会新闻、纯娱乐八卦、纯政策事件、纯赛事比分等一般判定为无商业意义。
4. 如果关键词本身较泛，但能稳定扩展为商品相关搜索词，也可判定为有商业意义。

输出要求：
1. 严格输出 JSON 数组，不要带额外解释。
2. 数组长度必须与输入热点词数量一致。
3. 每个元素必须包含以下字段：
   - keyword: 原始关键词
   - is_commercial: 布尔值
   - confidence: 0 到 1 的数值
   - category: 商品类目或消费方向，无商业价值时可填空字符串
   - intent_type: 可选值为 product/category/scene/crowd/trend/none
   - reason: 不超过80字的中文理由
   - expanded_keywords: 数组，给出 0 到 5 个适合实际采集的搜索词
   - recommended_platforms: 数组，可从 douyin、bilibili 中选择

输出示例：
${JSON.stringify(outputExample)}
  `.trim();

  return template;
}

module.exports = {
  buildVideoAnalysisPrompt,
  buildKeywordFilterPrompt,
  buildKeywordBatchFilterPrompt
}

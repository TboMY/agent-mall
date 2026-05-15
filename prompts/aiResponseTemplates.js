/**
 * AI 大模型对抖音视频分析后的标准输出模板
 * 用于统一解析和校验 LLM 返回结果
 */

/**
 * 有潜在商业价值的视频响应模板
 * @type {Object}
 * @property {boolean} is_valuable - 是否有价值
 * @property {Object} product_info - 商品信息对象
 * @property {string} product_info.name - 商品名称
 * @property {string} product_info.reason - 推荐理由
 * @property {string} product_info.category - 商品分类id（需与商城分类一致）
 */
const valuableVideoTemplate = {
  is_valuable: true,
  product_info: {
    name: '示例商品名称（如：蓝色比基尼泳装）',
    reason: '示例推荐理由（如：符合夏日海边穿搭潮流）',
    category: '商品分类的id（如：1）'
  }
};

/**
 * 无潜在商业价值的视频响应模板
 * @type {Object}
 * @property {boolean} is_valuable - 是否有价值
 * @property {Object} product_info - 空对象
 */
const nonValuableVideoTemplate = {
  is_valuable: false,
  product_info: {}
};

const commercialKeywordTemplate = {
  is_commercial: true,
  confidence: 0.86,
  category: '美妆/个护',
  intent_type: 'category',
  reason: '该关键词具备明确商品需求和消费场景，适合进入内容采集范围。',
  expanded_keywords: ['防晒霜推荐', '平价防晒', '军训防晒'],
  recommended_platforms: ['douyin', 'bilibili']
};

const commercialKeywordBatchTemplate = [
  {
    keyword: '防晒',
    is_commercial: true,
    confidence: 0.86,
    category: '美妆/个护',
    intent_type: 'category',
    reason: '该关键词具备明确商品需求和消费场景，适合进入内容采集范围。',
    expanded_keywords: ['防晒霜推荐', '平价防晒', '军训防晒'],
    recommended_platforms: ['douyin', 'bilibili']
  },
  {
    keyword: '某社会新闻',
    is_commercial: false,
    confidence: 0.08,
    category: '',
    intent_type: 'none',
    reason: '该关键词偏新闻事件，缺乏明确商品消费指向。',
    expanded_keywords: [],
    recommended_platforms: []
  }
];

module.exports = {
  valuableVideoTemplate,
  nonValuableVideoTemplate,
  commercialKeywordTemplate,
  commercialKeywordBatchTemplate
};

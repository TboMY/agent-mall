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

module.exports = {
  valuableVideoTemplate,
  nonValuableVideoTemplate
};
/**
 * 计算AI推荐商品的热度分数
 * @param {Object} params - 参数对象
 * @param {number} params.liked_count - 点赞数
 * @param {number} params.comment_count - 评论数
 * @param {number} params.share_count - 分享数
 * @param {number} params.collected_count - 收藏数
 * @param {number} params.create_time - 创建时间（秒级时间戳）
 * @returns {number} 热度分数（0-100）
 */
function calculateProductScore({
  liked_count,
  comment_count,
  share_count,
  collected_count,
  create_time // 单位：秒（如 1757416435）
}) {
  const now = Math.floor(Date.now() / 1000); // 当前时间戳（秒）

  // 安全转为整数
  const liked = parseInt(liked_count, 10) || 0;
  const comment = parseInt(comment_count, 10) || 0;
  const share = parseInt(share_count, 10) || 0;
  const collect = parseInt(collected_count, 10) || 0;

  // 1. 加权互动分（整体抬升权重）
  const rawScore =
    1.2 * liked +
    8.0 * comment +
    5.0 * share +
    6.0 * collect;

  // 2. 时间衰减（放缓衰减：半衰期10天 = 240小时），并对缺失时间做兜底
  const safeCreate = Number(create_time);
  const ageHours = Number.isFinite(safeCreate) && safeCreate > 0 ? (now - safeCreate) / 3600 : 0;
  const decayFactor = Math.exp(-ageHours / 240);
  const decayedScore = rawScore * decayFactor;

  // 3. 对数压缩 + 归一化到 0~100，并设置轻微的下限抬升
  if (decayedScore <= 0) return 0;

  const logScore = Math.log1p(decayedScore); // ln(1 + x)
  const cappedLog = Math.min(logScore, 25);  // 上限放宽
  let finalScore = (cappedLog / 25) * 100;

  // 软下限：如果互动量明显>0，最低给到10分
  if (finalScore < 10 && (liked + comment + share + collect) > 0) {
    finalScore = 10;
  }

  return Math.round(finalScore); // 取整数
}

/**
 * 根据推荐策略计算加权分数
 * @param {Object} params - 基础参数
 * @param {string} strategy - 推荐策略
 * @returns {number} 加权后的分数
 */
function calculateWeightedScore(params, strategy = 'viral_priority') {
  const baseScore = calculateProductScore(params);
  
  // 根据不同的推荐策略应用不同的权重
  switch (strategy) {
    case 'viral_priority': // 🔥 爆款优先：高点赞、高转发权重
      return baseScore; // 使用原始分数，因为原始算法已经考虑了点赞和转发
      
    case 'engagement_priority': // 💬 深度互动优先：高评论、高收藏权重
      // 增强评论和收藏的权重
      const engagementScore = 
        1.0 * (params.liked_count || 0) +
        8.0 * (params.comment_count || 0) + // 提高评论权重
        3.0 * (params.share_count || 0) +
        6.0 * (params.collected_count || 0); // 提高收藏权重
      
      const now = Math.floor(Date.now() / 1000);
      const safeCreate = Number(params.create_time);
      const ageHours = Number.isFinite(safeCreate) && safeCreate > 0 ? (now - safeCreate) / 3600 : 0;
      const decayFactor = Math.exp(-ageHours / 240);
      const decayedEngagementScore = engagementScore * decayFactor;
      
      if (decayedEngagementScore <= 0) return 0;
      const logScore = Math.log1p(decayedEngagementScore);
      const cappedLog = Math.min(logScore, 20);
      return Math.round((cappedLog / 20) * 100); // 取整数
      
    case 'freshness_priority': // ⏱️ 新鲜度优先：强时效衰减
      // 使用更短的时间衰减周期
      const now2 = Math.floor(Date.now() / 1000);
      const safeCreate2 = Number(params.create_time);
      const ageHours2 = Number.isFinite(safeCreate2) && safeCreate2 > 0 ? (now2 - safeCreate2) / 3600 : 0;
      const decayFactor2 = Math.exp(-ageHours2 / 72); // 3天半衰期，稍放缓但仍强调新鲜度
      const freshScore = baseScore * decayFactor2;
      return Math.round(freshScore); // 取整数
      
    default:
      return baseScore;
  }
}

module.exports = {
  calculateProductScore,
  calculateWeightedScore
};

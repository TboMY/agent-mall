var express = require('express')
var router = express.Router()
const ContentAnalysisService = require('../services/ContentAnalysisService')
const { requirePermission } = require('../middleware/auth')
const { PERMISSIONS } = require('../config/permissions')

router.post('/analyze', requirePermission(PERMISSIONS.AI_WORKBENCH_RUN), async function ( req, res ) {
  try {
    const mode = req?.body?.scheduled === true || req?.query?.scheduled === 'true' ||
      req?.body?.mode === 'scheduled' || req?.query?.mode === 'scheduled'
      ? 'scheduled'
      : 'manual'
    const result = await ContentAnalysisService.analyzePending({ mode })
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router

// 拉取最新N条爬虫视频并分析（无需请求体）
// router.get('/analyze-latest', async function ( req, res ) {
//   try {
//     const limit = Math.max(1, Math.min(Number(req.query.limit || 2), 20))
//     const threshold = Number(req.query.threshold || 0.7)
//     const strategy = req.query.strategy || 'viral_priority'
//     const tags = (req.query.tags || '').split(',').filter(Boolean)
//
//     if (!rows || rows.length === 0) return res.json({ threshold, results: [] })
//
//     const categories = await Category.getAll()
//     const categoryOptions = categories.map(c => c.name)
//     const system = undefined
//
//     const results = []
//     for (const aweme of rows) {
//       const promptText = Prompt.buildFullPromptForAweme(
//         { aweme, categoryOptions, tags })
//       const videoUrl = aweme.video_download_url || aweme.aweme_url ||
//         aweme.aweme_url || aweme.aweme_url
//       const content = await LLM.chatWithVideo(
//         { system, text: promptText, videoUrl, responseFormat: 'json_object' })
//       let parsed
//       try {
//         parsed = JSON.parse(content)
//       } catch (e) { parsed = { is_valuable: false, product_info: {} } }
//       const d = decide(parsed, threshold)
//
//       // 如果AI判断为有价值，计算热度分数并保存到候选商品表
//       let candidateId = null
//       if (d.decision === 'push' && parsed.is_valuable && parsed.product_info) {
//         try {
//           // 计算热度分数
//           const hotScore = calculateWeightedScore({
//             liked_count: normalizeCounts(aweme.liked_count),
//             comment_count: normalizeCounts(aweme.comment_count),
//             share_count: normalizeCounts(aweme.share_count),
//             collected_count: normalizeCounts(aweme.collected_count),
//             create_time: aweme.create_time
//           }, strategy)
//
//           // 保存到AI候选商品表
//           candidateId = await AIProductCandidate.create({
//             aweme_id: aweme.aweme_id,
//             product_name: parsed.product_info.name || aweme.title,
//             product_category: parsed.product_info.category || '未分类',
//             ai_reason: parsed.product_info.reason || parsed.reason ||
//               'AI推荐商品',
//             hot_score: hotScore,
//             cover_url: aweme.cover_url,
//             download_url: aweme.video_download_url,
//             source_url: aweme.aweme_url,
//             source_keyword: aweme.source_keyword || '',
//             status: 0 // 待审核
//           })
//         } catch (error) {
//           console.error('保存AI候选商品失败:', error)
//         }
//       }
//
//       results.push({
//         aweme_id: aweme.aweme_id,
//         model_result: parsed,
//         decision: d.decision,
//         final_score: d.final_score,
//         candidate_id: candidateId
//       })
//     }
//
//     res.json({ threshold, results })
//   } catch (error) {
//     console.error(error)
//     res.status(500).json({ error: error.message })
//   }
// })



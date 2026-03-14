var express = require('express')
var router = express.Router()
const DouyinAweme = require('../models/DouyinAweme')
const Category = require('../models/Category')
const LLM = require('../services/LLMService')
const Prompt = require('../services/PromptService')
const AIProductCandidate = require('../models/AIProductCandidate')
const { calculateWeightedScore } = require('../utils/scoreCalculator')
const SystemConfig = require('../models/SystemConfig')

function normalizeCounts ( numLike ) {
  const n = Number(numLike || 0)
  return Number.isFinite(n) ? n : 0
}

router.post('/analyze', async function ( req, res ) {
  try {
    // 模式：默认手动触发；当携带 scheduled 参数/模式时，走定时任务配置
    const isScheduled = req?.body?.scheduled === true || req?.query?.scheduled === 'true' ||
      req?.body?.mode === 'scheduled' || req?.query?.mode === 'scheduled'

    // 从系统配置读取AI工作台参数
    const aiConfig = await SystemConfig.getAIWorkbenchConfig()
    const strategy = aiConfig.aiModel.recommendationStrategy || 'viral_priority'

    // 数据来源：基于上次消费到的自增 id，按 id 升序继续拉取，避免重复
    const tags = []
    const limitCfg = isScheduled
      ? aiConfig?.scheduledTask?.productCount
      : aiConfig?.manualTrigger?.productCount
    const limit = Math.max(1, Number(limitCfg || 5))
    const afterId = Number(aiConfig?.crawlerState?.lastAwemeRowId || 0)
    const rows = await DouyinAweme.listAfterId({ afterId, limit })
    if (!rows || rows.length === 0) return res.status(404).
      json({ error: 'no aweme found' })

    const categories = await Category.getAll()
    // const categoryOptions = categories.map(c => c.name)
    const system = undefined

    console.log(`开始AI分析（${isScheduled ? '定时任务' : '手动触发'}），共 ${rows.length} 个视频`)

    // 创建异步处理函数
    const processAweme = async ( aweme ) => {
      try {
        // 仅处理视频类作品：aweme_type === '0'（非0直接跳过）
        if (String(aweme.aweme_type) !== '0') {
          return {
            aweme_id: aweme.aweme_id,
            is_valuable: false,
            candidate_id: null,
            skipped: true,
            reason: 'non-video'
          }
        }
        const promptText = Prompt.buildFullPromptForAweme(
          { aweme, categoryOptions: categories, tags })
        const videoUrl = aweme.video_download_url
        const content = await LLM.chatWithVideo({
          system,
          text: promptText,
          videoUrl,
          responseFormat: 'json_object'
        })

        let parsed
        try {
          parsed = JSON.parse(content)
        } catch (e) {
          parsed = { is_valuable: false, product_info: {} }
        }

        // 如果AI判断为有价值，计算热度分数并保存到候选商品表
        let candidateId = null
        if (parsed.is_valuable && parsed.product_info) {
          try {
            const hotScore = calculateWeightedScore({
              liked_count: normalizeCounts(aweme.liked_count),
              comment_count: normalizeCounts(aweme.comment_count),
              share_count: normalizeCounts(aweme.share_count),
              collected_count: normalizeCounts(aweme.collected_count),
              create_time: aweme.create_time
            }, strategy)

            candidateId = await AIProductCandidate.create({
              aweme_id: aweme.aweme_id,
              product_name: parsed.product_info.name || aweme.title,
              product_category: parsed.product_info.category || '未分类',
              ai_reason: parsed.product_info.reason || parsed.reason ||
                'AI推荐商品',
              hot_score: hotScore,
              cover_url: aweme.cover_url,
              download_url: aweme.video_download_url,
              source_url: aweme.aweme_url,
              source_keyword: aweme.source_keyword || '',
              status: 0
            })
          } catch (error) {
            console.error(`保存AI候选商品失败 (${ aweme.aweme_id }):`, error)
          }
        }

        return {
          aweme_id: aweme.aweme_id,
          is_valuable: parsed.is_valuable,
          candidate_id: candidateId
        }
      } catch (error) {
        console.error(`处理视频失败 (${ aweme.aweme_id }):`, error)
        return {
          aweme_id: aweme.aweme_id,
          is_valuable: false,
          candidate_id: null,
          error: error.message
        }
      }
    }

    // 并发处理所有视频
    const results = await Promise.all(rows.map(processAweme))

    // 推进 lastAwemeRowId
    try {
      const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), afterId)
      if (maxId > afterId && SystemConfig.setValue) {
        await SystemConfig.setValue('crawler_last_aweme_row_id', maxId, 'number', '爬虫库上次消费的最后一条ID', 'ai_workbench')
      }
    } catch (e) { console.warn('更新crawler_last_aweme_row_id失败:', e?.message || e) }

    console.log(`AI分析完成，共处理 ${results.length} 个视频，成功创建 ${results.filter(r => r.candidate_id).length} 个候选商品`)

    res.json({
      success: true,
      count: results.length,
      results
    })
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
//     const rows = await DouyinAweme.list({ page: 1, pageSize: limit })
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



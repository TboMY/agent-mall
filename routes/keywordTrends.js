const express = require('express');

const CommercialKeyword = require('../models/CommercialKeyword');
const CollectionRunLog = require('../models/CollectionRunLog');
const WorkbenchPipelineService = require('../services/WorkbenchPipelineService');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(requirePermission(PERMISSIONS.KEYWORD_TRENDS_MANAGE));

// 正式任务接口：定时热词任务
// 固定拉取 douyin / weibo / zhihu 三个 type 的热榜，
// 再执行“获取热词 -> AI筛词 -> 更新商业关键词池”，不执行内容采集。
router.post('/tasks/refresh-keyword-pool', async (req, res) => {
  try {
    const { hotlistLimit = null } = req.body || {};
    const result = await WorkbenchPipelineService.refreshKeywordPool({
      hotlistLimit
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('刷新商业关键词池失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'refresh_keyword_pool_failed',
      message: error.message || '刷新商业关键词池失败',
      error: error.message,
      details: error.details || null
    });
  }
});

// 正式任务接口：手动触发AI选品
// 只消费现有商业关键词池，执行“内容采集 -> 内容分析 -> 候选商品生成”。
// 这里不会再主动获取热词。
router.post('/pipeline/run', async (req, res) => {
  try {
    const { mode = 'manual', platforms = null, productCount = null } = req.body || {};
    const result = await WorkbenchPipelineService.runCollectionPipeline({
      mode,
      platforms,
      productCount
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('执行AI选品流水线失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'pipeline_failed',
      message: error.message || '执行AI选品流水线失败',
      error: error.message,
      details: error.details || null
    });
  }
});

// 数据查询：采集执行日志
router.get('/collection-runs', async (req, res) => {
  try {
    const result = await CollectionRunLog.list({
      platform: req.query.platform || null,
      status: req.query.status || null,
      page: req.query.page || 1,
      limit: req.query.limit || 20
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取采集执行日志失败:', error);
    res.status(500).json({ success: false, message: '获取采集执行日志失败', error: error.message });
  }
});

// 数据查询：商业关键词池列表
router.get('/commercial', async (req, res) => {
  try {
    const result = await CommercialKeyword.list({
      platform: req.query.platform || null,
      status: req.query.status || null,
      page: req.query.page || 1,
      limit: req.query.limit || 20
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取商业关键词失败:', error);
    res.status(500).json({ success: false, message: '获取商业关键词失败', error: error.message });
  }
});

module.exports = router;

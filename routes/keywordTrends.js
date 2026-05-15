const express = require('express');

const TrendingKeyword = require('../models/TrendingKeyword');
const CommercialKeyword = require('../models/CommercialKeyword');
const KeywordAnalysisResult = require('../models/KeywordAnalysisResult');
const CollectionRunLog = require('../models/CollectionRunLog');
const KeywordIntelligenceService = require('../services/KeywordIntelligenceService');
const WorkbenchPipelineService = require('../services/WorkbenchPipelineService');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(requirePermission(PERMISSIONS.KEYWORD_TRENDS_MANAGE));

router.get('/trending', async (req, res) => {
  try {
    const result = await TrendingKeyword.list({
      source: req.query.source || null,
      status: req.query.status || null,
      page: req.query.page || 1,
      limit: req.query.limit || 20
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取热点词失败:', error);
    res.status(500).json({ success: false, message: '获取热点词失败', error: error.message });
  }
});

router.post('/trending/import', async (req, res) => {
  try {
    const { source = 'manual', keywords = [], snapshot_time: snapshotTime = null } = req.body || {};
    const result = await KeywordIntelligenceService.importTrendingKeywords({
      source,
      keywords,
      snapshotTime
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('导入热点词失败:', error);
    res.status(500).json({ success: false, message: '导入热点词失败', error: error.message });
  }
});

router.post('/trending/sync-hotlist', async (req, res) => {
  try {
    const { type, limit = 20, analyze = false } = req.body || {};
    const result = await KeywordIntelligenceService.syncFromHotlist({
      type,
      limit,
      analyze
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('同步热榜失败:', error);
    res.status(500).json({ success: false, message: '同步热榜失败', error: error.message });
  }
});

router.post('/trending/analyze', async (req, res) => {
  try {
    const { limit = 20, ids = [] } = req.body || {};
    const result = await KeywordIntelligenceService.analyzePending({ limit, ids });
    res.json({
      success: true,
      data: {
        count: result.length,
        items: result
      }
    });
  } catch (error) {
    console.error('分析热点词失败:', error);
    res.status(500).json({ success: false, message: '分析热点词失败', error: error.message });
  }
});

router.post('/pipeline/run', async (req, res) => {
  try {
    const { mode = 'manual', platforms = null, productCount = null, hotlistLimit = null } = req.body || {};
    const result = await WorkbenchPipelineService.run({
      mode,
      platforms,
      productCount,
      hotlistLimit
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('执行AI选品流水线失败:', error);
    res.status(500).json({ success: false, message: '执行AI选品流水线失败', error: error.message });
  }
});

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

router.get('/trending/:id/analyses', async (req, res) => {
  try {
    const items = await KeywordAnalysisResult.listByTrendingKeywordId(req.params.id);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取关键词分析记录失败:', error);
    res.status(500).json({ success: false, message: '获取关键词分析记录失败', error: error.message });
  }
});

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

router.post('/commercial/:id/status', async (req, res) => {
  try {
    const nextStatus = req.body?.status || 'paused';
    const existing = await CommercialKeyword.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '未找到关键词' });
    }

    const success = await CommercialKeyword.updateStatus(req.params.id, nextStatus);
    res.json({ success, message: success ? '状态更新成功' : '未找到关键词' });
  } catch (error) {
    console.error('更新商业关键词状态失败:', error);
    res.status(500).json({ success: false, message: '更新商业关键词状态失败', error: error.message });
  }
});

module.exports = router;

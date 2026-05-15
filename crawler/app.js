const express = require('express');

const CollectorService = require('../services/crawler/CollectorService');

function createCrawlerApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      service: 'agent-mall-crawler',
      platforms: CollectorService.getSupportedPlatforms()
    });
  });

  app.get('/platforms', (req, res) => {
    res.json({
      success: true,
      data: CollectorService.getSupportedPlatforms()
    });
  });

  app.post('/collect', async (req, res) => {
    try {
      const { platform, keywords, limit, options } = req.body || {};
      const result = await CollectorService.collectAndStore({
        platform,
        keywords,
        limit,
        options
      });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[crawler] collect failed:', error);
      res.status(500).json({
        success: false,
        message: '采集失败',
        error: error.message
      });
    }
  });

  return app;
}

module.exports = createCrawlerApp;

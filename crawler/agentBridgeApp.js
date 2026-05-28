const express = require('express');

const ClaudeCodeRunner = require('../services/crawler/ClaudeCodeRunner');
const buildDouyinAgentPrompt = require('../services/crawler/prompts/buildDouyinAgentPrompt');

function createDouyinSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'message', 'items'],
    properties: {
      success: { type: 'boolean' },
      code: { type: ['string', 'null'] },
      message: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['platform_content_id', 'source_keyword'],
          additionalProperties: true,
          properties: {
            platform_content_id: { type: 'string' },
            title: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            cover_url: { type: ['string', 'null'] },
            source_url: { type: ['string', 'null'] },
            play_url: { type: ['string', 'null'] },
            publish_time: { type: ['integer', 'null'] },
            liked_count: { type: ['number', 'null'] },
            comment_count: { type: ['number', 'null'] },
            share_count: { type: ['number', 'null'] },
            favorite_count: { type: ['number', 'null'] },
            view_count: { type: ['number', 'null'] },
            author_id: { type: ['string', 'null'] },
            author_name: { type: ['string', 'null'] },
            author_avatar: { type: ['string', 'null'] },
            content_type: { type: ['string', 'null'] },
            source_keyword: { type: 'string' }
          }
        }
      }
    }
  };
}

function getRunnerOptions() {
  const defaultWorkspaceCwd = 'D:\\cc-chat';
  return {
    executablePath: process.env.CLAUDE_CODE_EXECUTABLE_PATH || process.env.CLAUDE_CODE_PATH || '',
    model: process.env.COLLECTOR_AGENT_MODEL || process.env.COLLECTOR_DOUYIN_AGENT_MODEL || 'sonnet',
    timeoutMs: Number(process.env.COLLECTOR_AGENT_CLAUDE_TIMEOUT_MS || 300000),
    maxBudgetUsd: process.env.COLLECTOR_AGENT_MAX_BUDGET_USD
      ? Number(process.env.COLLECTOR_AGENT_MAX_BUDGET_USD)
      : undefined,
    cwd: process.env.COLLECTOR_AGENT_CWD || defaultWorkspaceCwd
  };
}

function authorizeRequest(req) {
  const expected = String(process.env.COLLECTOR_AGENT_BRIDGE_API_KEY || '').trim();
  if (!expected) return true;
  const actual = String(req.header('X-Agent-Crawler-Key') || '').trim();
  return actual === expected;
}

function buildRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createAgentBridgeApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (req, res) => {
    const runnerOptions = getRunnerOptions();
    res.json({
      success: true,
      service: 'agent-mall-claude-bridge',
      model: runnerOptions.model,
      cwd: runnerOptions.cwd,
      executablePath: runnerOptions.executablePath || 'claude'
    });
  });

  app.post('/crawl/douyin', async (req, res) => {
    const requestId = buildRequestId();
    if (!authorizeRequest(req)) {
      console.warn(`[agent-bridge] unauthorized request requestId=${requestId}`);
      return res.status(401).json({
        success: false,
        code: 'unauthorized',
        message: 'invalid agent bridge api key',
        items: []
      });
    }

    const {
      keywords = [],
      limit = 10,
      result_limit_per_keyword: resultLimitPerKeyword = 10,
      timeout_ms: timeoutMs = null,
      session_profile: sessionProfile = 'douyin-default'
    } = req.body || {};

    const normalizedKeywords = Array.isArray(keywords)
      ? keywords.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    console.log(`[agent-bridge] request received requestId=${requestId} keywords=${normalizedKeywords.join(',') || '-'} limit=${limit} perKeyword=${resultLimitPerKeyword} timeoutMs=${timeoutMs || '-'} profile=${sessionProfile}`);
    if (normalizedKeywords.length === 0) {
      console.warn(`[agent-bridge] invalid keywords requestId=${requestId}`);
      return res.status(400).json({
        success: false,
        code: 'invalid_keywords',
        message: 'keywords is required',
        items: []
      });
    }

    try {
      const runnerOptions = getRunnerOptions();
      console.log(`[agent-bridge] create runner requestId=${requestId} model=${runnerOptions.model} cwd=${runnerOptions.cwd} executable=${runnerOptions.executablePath || 'claude'}`);
      const runner = new ClaudeCodeRunner(runnerOptions);
      const prompt = buildDouyinAgentPrompt({
        keywords: normalizedKeywords,
        limit: Number(limit || 10),
        resultLimitPerKeyword: Number(resultLimitPerKeyword || 10),
        sessionProfile
      });
      const schema = createDouyinSchema();
      console.log(`[agent-bridge] invoke claude requestId=${requestId}`);
      const result = await runner.runStructuredPrompt({
        prompt,
        schema,
        timeoutMs: Number(timeoutMs || runnerOptions.timeoutMs)
      });
      const itemCount = Array.isArray(result?.structured?.items) ? result.structured.items.length : 0;
      console.log(`[agent-bridge] claude success requestId=${requestId} success=${result?.structured?.success} itemCount=${itemCount} code=${result?.structured?.code || '-'} message=${result?.structured?.message || '-'}`);

      res.json({
        ...result.structured,
        metadata: {
          session_id: result.raw.session_id || null,
          duration_ms: result.raw.duration_ms || null,
          total_cost_usd: result.raw.total_cost_usd || null,
          model: runnerOptions.model,
          request_id: requestId
        }
      });
    } catch (error) {
      console.error(`[agent-bridge] douyin crawl failed requestId=${requestId}:`, error);
      res.status(500).json({
        success: false,
        code: 'agent_bridge_failed',
        message: error.message || 'agent bridge failed',
        items: []
      });
    }
  });

  return app;
}

module.exports = createAgentBridgeApp;

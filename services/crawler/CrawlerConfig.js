const path = require('path');

/**
 * 规范化关键词输入。
 * 同时兼容数组和逗号分隔字符串两种形式。
 */
function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * 返回独立采集服务的监听配置。
 */
function getServerConfig() {
  return {
    host: process.env.COLLECTOR_SERVER_HOST || '127.0.0.1',
    port: Number(process.env.COLLECTOR_SERVER_PORT || 3088)
  };
}

/**
 * 根据平台和环境变量解析采集器基础配置。
 * 包括浏览器运行方式、无头模式、视频大小限制等。
 */
function getBaseCollectorOptions(platform) {
  const silentMode = platform === 'douyin'
    ? (process.env.COLLECTOR_DOUYIN_SILENT === 'true'
      ? true
      : (process.env.COLLECTOR_DOUYIN_SILENT === 'false'
        ? false
        : false))
    : false;
  const globalHeadless = process.env.COLLECTOR_HEADLESS === 'true'
    ? true
    : (process.env.COLLECTOR_HEADLESS === 'false'
      ? false
      : false);
  const douyinHeadless = process.env.COLLECTOR_DOUYIN_HEADLESS === 'true'
    ? true
    : (process.env.COLLECTOR_DOUYIN_HEADLESS === 'false'
      ? false
      : (platform === 'douyin' ? silentMode : globalHeadless));

  const maxVideoBytes = process.env.COLLECTOR_MAX_VIDEO_BYTES
    ? Number(process.env.COLLECTOR_MAX_VIDEO_BYTES)
    : Number(process.env.COLLECTOR_MAX_VIDEO_MB || 100) * 1024 * 1024;

  return {
    timeoutMs: Number(process.env.COLLECTOR_TIMEOUT_MS || 30000),
    maxVideoBytes: Number.isFinite(maxVideoBytes) && maxVideoBytes > 0
      ? maxVideoBytes
      : 100 * 1024 * 1024,
    headless: platform === 'douyin' ? douyinHeadless : globalHeadless,
    userDataDir: platform === 'douyin'
      ? (process.env.COLLECTOR_DOUYIN_USER_DATA_DIR
        || path.join(process.cwd(), '.crawler-data', 'douyin'))
      : undefined,
    browserMode: platform === 'douyin'
      ? (process.env.COLLECTOR_DOUYIN_BROWSER_MODE
        || (silentMode ? 'persistent' : null)
        || (process.env.COLLECTOR_DOUYIN_CDP_URL ? 'cdp' : 'persistent'))
      : undefined,
    cdpUrl: platform === 'douyin'
      ? (process.env.COLLECTOR_DOUYIN_CDP_URL || null)
      : undefined,
    executablePath: platform === 'douyin'
      ? (process.env.COLLECTOR_DOUYIN_EXECUTABLE_PATH || null)
      : undefined,
    remoteDebuggingPort: platform === 'douyin'
      ? Number(process.env.COLLECTOR_DOUYIN_REMOTE_DEBUGGING_PORT || 9222)
      : undefined,
    silentMode
  };
}

/**
 * 统一解析一次采集任务的输入参数。
 */
function resolveRunInput(input = {}) {
  const platform = input.platform || 'douyin';

  const keywords = normalizeKeywords(input.keywords ?? []);

  const limit = Number(input.limit ?? 10);

  return {
    platform,
    keywords,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    options: {
      keywordPoolLimit: Number(process.env.COLLECTOR_KEYWORD_POOL_LIMIT || 5),
      ...(input.options || {})
    }
  };
}

module.exports = {
  getServerConfig,
  getBaseCollectorOptions,
  resolveRunInput,
  normalizeKeywords
};

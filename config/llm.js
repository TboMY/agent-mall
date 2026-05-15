require('dotenv').config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getVideoAnalysisConfig() {
  return {
    baseURL: process.env.LLM_API_BASE_VIDEO_ANALYSIS || '',
    apiKey: process.env.LLM_API_KEY_VIDEO_ANALYSIS || '',
    model: process.env.LLM_MODEL_VIDEO_ANALYSIS || 'qwen3-vl-plus',
    temperature: toNumber(process.env.LLM_TEMPERATURE_VIDEO_ANALYSIS, 0)
  };
}

function getKeywordFilterConfig() {
  return {
    baseURL: process.env.LLM_API_BASE_KEYWORD_FILTER || '',
    apiKey: process.env.LLM_API_KEY_KEYWORD_FILTER || '',
    model: process.env.LLM_MODEL_KEYWORD_FILTER || 'qwen3.6-plus',
    temperature: toNumber(process.env.LLM_TEMPERATURE_KEYWORD_FILTER, 0.2)
  };
}

function getTaskConfig(task = 'default') {
  if (task === 'keyword_filter') {
    return getKeywordFilterConfig();
  }

  return getVideoAnalysisConfig();
}

module.exports = {
  ...getTaskConfig(),
  getTaskConfig,
  getVideoAnalysisConfig,
  getKeywordFilterConfig
};

require('dotenv').config();

module.exports = {
  baseURL: process.env.LLM_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  model: process.env.LLM_MODEL || 'qwen3-vl-plus',
  temperature: Number(process.env.LLM_TEMPERATURE || '0')
};



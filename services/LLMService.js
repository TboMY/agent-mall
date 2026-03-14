require('dotenv').config();
const OpenAI = require('openai');
const llmConf = require('../config/llm');

class LLMService {
  constructor() {
    this.apiBase = llmConf.baseURL;
    this.apiKey = llmConf.apiKey;
    this.model = llmConf.model;
    this.temperature = llmConf.temperature;
    this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.apiBase });
  }

  async chatJson({ system, user, responseFormat = 'json_object' }) {
    if (!this.apiBase || !this.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages: [
        system ? { role: 'system', content: system } : null,
        { role: 'user', content: user }
      ].filter(Boolean)
    });
    return response.choices?.[0]?.message?.content;
  }

  async chatWithVideo({ system, text, videoUrl, responseFormat = 'json_object' }) {
    if (!this.apiBase || !this.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({
      role: 'user',
      content: [
        { type: 'video_url', video_url: { url: videoUrl } },
        { type: 'text', text }
      ]
    });

    const response = await this.client.chat.completions.create({
      model: this.model || 'qwen3-vl-plus',
      temperature: this.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages
    });
    return response.choices?.[0]?.message?.content;
  }
}

module.exports = new LLMService();



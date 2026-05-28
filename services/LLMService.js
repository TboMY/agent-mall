require('dotenv').config();
const OpenAI = require('openai');
const llmConf = require('../config/llm');

/**
 * 大模型调用服务。
 * 统一封装不同任务的视频分析/关键词过滤调用，并按 baseURL + key 复用客户端实例。
 */
class LLMService {
  constructor() {
    this.clientCache = new Map();
  }

  /**
   * 根据任务名返回当前任务对应的模型配置。
   */
  getTaskConfig(task = 'default') {
    return llmConf.getTaskConfig ? llmConf.getTaskConfig(task) : llmConf;
  }

  /**
   * 按 baseURL + apiKey 缓存 OpenAI 客户端，避免重复创建。
   */
  getClient({ baseURL, apiKey }) {
    const cacheKey = `${baseURL}::${apiKey}`;
    if (!this.clientCache.has(cacheKey)) {
      this.clientCache.set(cacheKey, new OpenAI({ apiKey, baseURL }));
    }
    return this.clientCache.get(cacheKey);
  }

  /**
   * 发送普通文本/JSON 任务到模型。
   */
  async chatJson({ task = 'default', system, user, responseFormat = 'json_object' }) {
    const taskConfig = this.getTaskConfig(task);
    if (!taskConfig.baseURL || !taskConfig.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }
    const client = this.getClient(taskConfig);

    const response = await client.chat.completions.create({
      model: taskConfig.model,
      temperature: taskConfig.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages: [
        system ? { role: 'system', content: system } : null,
        { role: 'user', content: user }
      ].filter(Boolean)
    });
    return response.choices?.[0]?.message?.content;
  }

  /**
   * 发送“视频 + 文本提示”到多模态模型。
   */
  async chatWithVideo({ task = 'video_analysis', system, text, videoUrl, responseFormat = 'json_object' }) {
    const taskConfig = this.getTaskConfig(task);
    if (!taskConfig.baseURL || !taskConfig.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }
    const client = this.getClient(taskConfig);

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({
      role: 'user',
      content: [
        { type: 'video_url', video_url: { url: videoUrl } },
        { type: 'text', text }
      ]
    });

    const response = await client.chat.completions.create({
      model: taskConfig.model || 'qwen3-vl-plus',
      temperature: taskConfig.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages
    });
    return response.choices?.[0]?.message?.content;
  }

  async chatWithImage({ task = 'video_analysis', system, text, imageUrl, responseFormat = 'json_object' }) {
    const taskConfig = this.getTaskConfig(task);
    if (!taskConfig.baseURL || !taskConfig.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }
    const client = this.getClient(taskConfig);

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text }
      ]
    });

    const response = await client.chat.completions.create({
      model: taskConfig.model || 'qwen3-vl-plus',
      temperature: taskConfig.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages
    });
    return response.choices?.[0]?.message?.content;
  }

  /**
   * 获取某个任务当前使用的模型名，便于写入分析记录。
   */
  getModelName(task = 'default') {
    return this.getTaskConfig(task).model;
  }
}

module.exports = new LLMService();

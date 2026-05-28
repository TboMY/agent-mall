const axios = require('axios');

class AgentCrawlerClient {
  constructor(options = {}) {
    this.baseURL = String(options.baseURL || 'http://127.0.0.1:3188').replace(/\/+$/, '');
    this.endpoint = String(options.endpoint || '/crawl/douyin');
    this.timeoutMs = Number(options.timeoutMs || 120000);
    this.apiKey = String(options.apiKey || '').trim();
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  buildHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (this.apiKey) {
      headers['X-Agent-Crawler-Key'] = this.apiKey;
    }
    return headers;
  }

  async crawlDouyin(payload = {}) {
    const keywords = Array.isArray(payload.keywords) ? payload.keywords.join(',') : '-';
    console.log(`[agent-client] request start baseURL=${this.baseURL} endpoint=${this.endpoint} limit=${payload.limit || '-'} keywords=${keywords}`);
    try {
      const response = await this.http.post(this.endpoint, payload, {
        headers: this.buildHeaders(payload.headers)
      });
      const itemCount = Array.isArray(response?.data?.items)
        ? response.data.items.length
        : (Array.isArray(response?.data?.data?.items) ? response.data.data.items.length : 0);
      console.log(`[agent-client] request success status=${response.status} itemCount=${itemCount} success=${response?.data?.success}`);
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error.message || 'agent crawler request failed';
      console.error(`[agent-client] request failed status=${status || '-'} message=${message}`);
      if (status) {
        throw new Error(`agent bridge request failed status=${status} message=${message}`);
      }
      throw new Error(`agent bridge request failed message=${message}`);
    }
  }
}

module.exports = AgentCrawlerClient;

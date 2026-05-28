const path = require('path');
const axios = require('axios');

const { sleep, sanitizeNumber, parseContentRangeTotal } = require('../utils');
const { signSearchParams, createWebId } = require('./DouyinSigner');

/**
 * 抖音采集器。
 * 通过 Playwright 驱动浏览器搜索页面，抓取搜索结果并转换成统一内容结构。
 */
class DouyinCollector {
  constructor(options = {}) {
    this.headless = options.headless === true;
    this.silentMode = options.silentMode === true;
    this.timeoutMs = Number(options.timeoutMs || 30000);
    this.userDataDir = options.userDataDir || path.join(process.cwd(), '.crawler-data', 'douyin');
    this.browserMode = options.browserMode || (options.cdpUrl ? 'cdp' : 'persistent');
    this.cdpUrl = options.cdpUrl || 'http://127.0.0.1:9222';
    this.executablePath = options.executablePath || null;
    this.remoteDebuggingPort = Number(options.remoteDebuggingPort || 9222);
    this.viewport = options.viewport || { width: 1440, height: 960 };
    this.maxVideoBytes = Number(options.maxVideoBytes || 100 * 1024 * 1024);
    this.http = axios.create({
      timeout: this.timeoutMs,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Referer: 'https://www.douyin.com/'
      },
      validateStatus: status => status >= 200 && status < 400
    });
  }

  /**
   * 懒加载 Playwright，避免未安装时在 require 阶段直接崩溃。
   */
  async loadPlaywright() {
    try {
      return require('playwright');
    } catch (error) {
      throw new Error('缺少 playwright 依赖，请先在 agent-mall 中执行 npm install');
    }
  }

  /**
   * 根据关键词生成抖音搜索页地址。
   */
  buildSearchUrl(keyword) {
    return `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=general`;
  }

  parseRuntimeInfo(userAgent = '') {
    const chromeVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '136.0.0.0';
    const osName = /Mac OS X/i.test(userAgent)
      ? 'Mac OS'
      : (/Windows/i.test(userAgent) ? 'Windows' : 'Linux');
    const osVersion = /Windows NT ([\d.]+)/i.test(userAgent)
      ? (userAgent.match(/Windows NT ([\d.]+)/i)?.[1] || '10.0')
      : (/Mac OS X ([\d_]+)/i.test(userAgent)
        ? (userAgent.match(/Mac OS X ([\d_]+)/i)?.[1] || '10_15_7').replace(/_/g, '.')
        : '0');

    return {
      browserVersion: chromeVersion,
      osName,
      osVersion,
      engineVersion: chromeVersion.split('.')[0] || '136'
    };
  }

  buildSearchParams(keyword, offset, searchId, runtime) {
    const runtimeInfo = this.parseRuntimeInfo(runtime.userAgent || '');
    const params = new URLSearchParams({
      search_channel: 'aweme_general',
      enable_history: '1',
      keyword,
      search_source: 'tab_search',
      query_correct_type: '1',
      is_filter_search: '0',
      from_group_id: '',
      offset: String(offset),
      count: '15',
      need_filter_settings: '1',
      list_type: 'multi',
      search_id: searchId || '',
      device_platform: 'webapp',
      aid: '6383',
      channel: 'channel_pc_web',
      version_code: '190600',
      version_name: '19.6.0',
      update_version_code: '170400',
      pc_client_type: '1',
      cookie_enabled: 'true',
      browser_language: runtime.language || 'zh-CN',
      browser_platform: runtime.platform || 'Win32',
      browser_name: 'Chrome',
      browser_version: runtimeInfo.browserVersion,
      browser_online: String(runtime.online !== false),
      engine_name: 'Blink',
      os_name: runtimeInfo.osName,
      os_version: runtimeInfo.osVersion,
      cpu_core_num: String(runtime.hardwareConcurrency || 8),
      device_memory: String(runtime.deviceMemory || 8),
      engine_version: runtimeInfo.engineVersion,
      platform: 'PC',
      screen_width: String(runtime.screenWidth || this.viewport.width || 1440),
      screen_height: String(runtime.screenHeight || this.viewport.height || 960),
      effective_type: '4g',
      round_trip_time: '50',
      webid: createWebId(),
      msToken: runtime.xmst || ''
    });
    return params;
  }

  async createApiPage(browserContext) {
    const page = await browserContext.newPage();
    await page.goto('https://www.douyin.com/', {
      waitUntil: 'domcontentloaded',
      timeout: this.timeoutMs
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
    const barrier = await this.detectVerificationBarrier(page);
    if (barrier.blocked) {
      await page.close().catch(() => null);
      throw new Error(
        `抖音当前触发了验证码/安全验证（title=${barrier.pageTitle || '-'}）。请先用同一个 crawler profile 在可见窗口里完成一次验证，再重试采集。`
      );
    }
    return page;
  }

  async getPageRuntime(page) {
    return await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      online: navigator.onLine,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      xmst: window.localStorage.getItem('xmst') || '',
      hasUserLogin: window.localStorage.getItem('HasUserLogin') || ''
    }));
  }

  async detectVerificationBarrier(page) {
    const pageTitle = await page.title().catch(() => '');
    const pageUrl = page.url();
    const pageContent = await page.locator('body').innerText().catch(() => '');
    const combined = `${pageTitle}\n${pageUrl}\n${pageContent}`;
    const blocked = /验证码中间页|验证码|安全验证|请完成验证|异常访问|访问过于频繁/i.test(combined);
    return {
      blocked,
      pageTitle,
      pageUrl
    };
  }

  isSearchResponseUrl(url) {
    return url.includes('/aweme/v1/web/general/search/single/')
      || url.includes('/aweme/v1/web/search/item/')
      || url.includes('/aweme/v1/web/discover/search/');
  }

  /**
   * 打开或连接浏览器上下文。
   * 支持持久化模式和 CDP 连接模式两种运行方式。
   */
  async openBrowserContext(playwright) {
    console.log(`[douyin] open browser mode=${this.browserMode} headless=${this.headless} silent=${this.silentMode} cdpUrl=${this.cdpUrl}`);
    if (this.silentMode && this.browserMode === 'cdp') {
      throw new Error('抖音静默模式不支持 cdp。部署时请将 COLLECTOR_DOUYIN_BROWSER_MODE 设置为 persistent，并开启 COLLECTOR_DOUYIN_HEADLESS=true。');
    }

    if (this.browserMode === 'cdp') {
      let browser;
      try {
        browser = await playwright.chromium.connectOverCDP(this.cdpUrl, {
          timeout: this.timeoutMs
        });
      } catch (error) {
        throw new Error(
          `无法连接开发 Chrome（${this.cdpUrl}）。请先用带 --remote-debugging-port=${this.remoteDebuggingPort} 和 --user-data-dir 的快捷方式启动你的小号 Chrome。原始错误: ${error.message}`
        );
      }
      const browserContext = browser.contexts()[0];
      if (!browserContext) {
        await browser.close();
        throw new Error(`已连接到 CDP，但没有可用的浏览器上下文: ${this.cdpUrl}`);
      }

      return {
        browserContext,
        close: async () => {
          console.log('[douyin] close browser via cdp');
          await browser.close();
        }
      };
    }

    const launchArgs = [`--remote-debugging-port=${this.remoteDebuggingPort}`];
    let browserContext;
    try {
      browserContext = await playwright.chromium.launchPersistentContext(this.userDataDir, {
        executablePath: this.executablePath || undefined,
        headless: this.headless,
        viewport: this.viewport,
        timeout: this.timeoutMs,
        args: launchArgs
      });
    } catch (error) {
      const shouldFallbackToCdp = this.cdpUrl
        && /ProcessSingleton|profile directory|exitCode=21|Failed to launch the browser process/i.test(error.message || '');
      if (shouldFallbackToCdp) {
        console.warn(`[douyin] persistent launch failed, fallback to cdp url=${this.cdpUrl} error=${error.message}`);
        let browser;
        try {
          browser = await playwright.chromium.connectOverCDP(this.cdpUrl, {
            timeout: this.timeoutMs
          });
        } catch (cdpError) {
          throw new Error(
            `抖音浏览器已被现有开发实例占用，并且回退连接 CDP 失败（${this.cdpUrl}）。请确认你的小号 Chrome 已通过 --remote-debugging-port=${this.remoteDebuggingPort} 启动。原始错误: ${cdpError.message}`
          );
        }
        const cdpContext = browser.contexts()[0];
        if (!cdpContext) {
          await browser.close();
          throw new Error(`已连接到 CDP，但没有可用的浏览器上下文: ${this.cdpUrl}`);
        }
        return {
          browserContext: cdpContext,
          close: async () => {
            console.log('[douyin] close browser via persistent-fallback-cdp');
            await browser.close();
          }
        };
      }
      if (!this.executablePath && /Executable doesn't exist/i.test(error.message)) {
        throw new Error(
          '当前处于 persistent 模式，但 Playwright 自带浏览器未安装。可以执行 npx playwright install 下载浏览器，或配置 COLLECTOR_DOUYIN_EXECUTABLE_PATH 指向服务器上的 Chrome/Chromium。'
        );
      }
      throw error;
    }

    return {
      browserContext,
      close: async () => {
        console.log('[douyin] close persistent browser context');
        await browserContext.close();
      }
    };
  }

  /**
   * 从搜索接口响应里提取 aweme 列表。
   */
  extractSearchItems(payload) {
    const items = [];
    const data = payload?.data || [];
    for (const postItem of data) {
      const awemeInfo = postItem?.aweme_info || postItem?.aweme_mix_info?.mix_items?.[0];
      if (awemeInfo) {
        items.push(awemeInfo);
      }
    }
    return items;
  }

  /**
   * 把抖音原始 aweme 数据转换为项目统一内容结构。
   */
  normalizeAwemeItem(awemeItem, keyword) {
    const author = awemeItem.author || {};
    const stat = awemeItem.statistics || {};
    const video = awemeItem.video || {};
    const coverList = (video.raw_cover || video.origin_cover || {}).url_list || [];
    const playList = video.play_addr_h264?.url_list || video.play_addr_256?.url_list || video.play_addr?.url_list || [];
    const imageList = Array.isArray(awemeItem.images) ? awemeItem.images : [];
    const hasImages = imageList.length > 0;

    return {
      platform: 'douyin',
      platform_content_id: String(awemeItem.aweme_id || ''),
      content_type: hasImages ? 'image_post' : 'video',
      title: awemeItem.desc || '',
      description: awemeItem.desc || '',
      author_id: author.uid ? String(author.uid) : '',
      author_name: author.nickname || '',
      author_avatar: author.avatar_thumb?.url_list?.[0] || '',
      cover_url: coverList[1] || coverList[0] || '',
      source_url: awemeItem.aweme_id ? `https://www.douyin.com/video/${awemeItem.aweme_id}` : '',
      play_url: playList[playList.length - 1] || '',
      publish_time: Number(awemeItem.create_time || 0) || null,
      liked_count: sanitizeNumber(stat.digg_count),
      comment_count: sanitizeNumber(stat.comment_count),
      share_count: sanitizeNumber(stat.share_count),
      favorite_count: sanitizeNumber(stat.collect_count),
      view_count: sanitizeNumber(stat.play_count),
      source_keyword: keyword,
      raw_payload: awemeItem
    };
  }

  /**
   * 尝试探测视频文件大小。
   * 会优先走 HEAD，其次用 Range 请求从响应头推断总大小。
   */
  async resolveMediaSizeBytes(playUrl) {
    if (!playUrl) return null;
    try {
      const headResp = await this.http.head(playUrl);
      const contentLength = Number(headResp?.headers?.['content-length'] || 0);
      if (Number.isFinite(contentLength) && contentLength > 0) {
        return contentLength;
      }
    } catch (error) {
      console.warn(`[douyin] head size probe failed url=${playUrl.slice(0, 80)} error=${error.message}`);
    }

    try {
      const rangeResp = await this.http.get(playUrl, {
        headers: {
          Range: 'bytes=0-0'
        },
        responseType: 'stream'
      });
      const total = parseContentRangeTotal(rangeResp?.headers?.['content-range']);
      if (rangeResp?.data?.destroy) {
        rangeResp.data.destroy();
      }
      return total;
    } catch (error) {
      console.warn(`[douyin] range size probe failed url=${playUrl.slice(0, 80)} error=${error.message}`);
      return null;
    }
  }

  /**
   * 判断一条内容是否可以进入后续流程。
   * 当前主要用于按视频体积阈值过滤超大视频。
   */
  async shouldKeepItem(item) {
    if (item.content_type !== 'video' || !item.play_url) {
      return { keep: true, sizeBytes: null };
    }

    const sizeBytes = await this.resolveMediaSizeBytes(item.play_url);
    if (sizeBytes === null) {
      console.log(`[douyin] size unknown keep video=${item.platform_content_id}`);
      return { keep: true, sizeBytes: null };
    }
    if (sizeBytes > this.maxVideoBytes) {
      console.warn(`[douyin] skip oversized video=${item.platform_content_id} sizeBytes=${sizeBytes} limitBytes=${this.maxVideoBytes}`);
      return { keep: false, sizeBytes };
    }
    return { keep: true, sizeBytes };
  }

  async fetchSearchPage(page, keyword, offset, searchId, runtime) {
    const params = this.buildSearchParams(keyword, offset, searchId, runtime);
    const queryWithoutSignature = params.toString();
    const aBogus = signSearchParams(queryWithoutSignature, runtime.userAgent || '');
    params.set('a_bogus', aBogus);
    const fetchUrl = `https://www.douyin.com/aweme/v1/web/general/search/single/?${params.toString()}`;
    const refererUrl = this.buildSearchUrl(keyword);

    console.log(`[douyin] direct search request keyword=${keyword} offset=${offset}`);
    return await page.evaluate(async ({ targetUrl, referrer }) => {
      const response = await fetch(targetUrl, {
        method: 'GET',
        credentials: 'include',
        referrer,
        headers: {
          accept: 'application/json, text/plain, */*'
        }
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text
      };
    }, {
      targetUrl: fetchUrl,
      referrer: refererUrl
    });
  }

  /**
   * 采集单个关键词下的若干抖音内容。
   */
  async collectByKeyword(browserContext, keyword, limit) {
    const page = await this.createApiPage(browserContext);
    try {
      console.log(`[douyin] keyword start keyword=${keyword} limit=${limit}`);
      const runtime = await this.getPageRuntime(page);
      if (runtime.hasUserLogin !== '1' && !runtime.xmst) {
        throw new Error('抖音 crawler profile 当前没有有效登录态，请先完成一次可见窗口登录后再重试');
      }

      let payload = null;
      let searchId = '';
      let offset = 0;
      const results = [];
      const seen = new Set();

      while (results.length < limit) {
        const apiResponse = await this.fetchSearchPage(page, keyword, offset, searchId, runtime);
        if (!apiResponse.ok) {
          throw new Error(`抖音搜索接口请求失败，status=${apiResponse.status}`);
        }
        try {
          payload = JSON.parse(apiResponse.text || '{}');
        } catch (error) {
          const title = await page.title().catch(() => '-');
          throw new Error(`抖音搜索接口返回无法解析的内容（title=${title}）`);
        }

        if (!Array.isArray(payload?.data)) {
          const title = await page.title().catch(() => '-');
          const barrier = await this.detectVerificationBarrier(page);
          if (barrier.blocked) {
            throw new Error(
              `抖音当前触发了验证码/安全验证（title=${barrier.pageTitle || title || '-'}）。请先用同一个 crawler profile 在可见窗口里完成一次验证，再重试采集。`
            );
          }
          throw new Error(`抖音搜索接口返回异常数据，keyword=${keyword}`);
        }

        searchId = payload?.extra?.logid || searchId;
        const awemeItems = this.extractSearchItems(payload);
        console.log(`[douyin] page payload keyword=${keyword} offset=${offset} awemeCount=${awemeItems.length}`);
        if (awemeItems.length === 0) break;

        for (const awemeItem of awemeItems) {
          const awemeId = String(awemeItem.aweme_id || '');
          if (!awemeId || seen.has(awemeId)) continue;
          seen.add(awemeId);
          const item = this.normalizeAwemeItem(awemeItem, keyword);
          const mediaDecision = await this.shouldKeepItem(item);
          if (!mediaDecision.keep) {
            continue;
          }
          if (mediaDecision.sizeBytes !== null) {
            item.media_size_bytes = mediaDecision.sizeBytes;
          }
          results.push(item);
          if (results.length >= limit) break;
        }

        if (results.length >= limit) break;

        offset += 15;
        await sleep(400);
      }

      console.log(`[douyin] keyword done keyword=${keyword} resultCount=${results.length}`);
      return results.slice(0, limit);
    } finally {
      await page.close();
    }
  }

  /**
   * 执行一次抖音采集任务。
   * 会按关键词顺序抓取结果，并做内容去重与体积过滤。
   */
  async collect({ keywords = [], limit = 10 } = {}) {
    const normalizedKeywords = keywords.filter(Boolean);
    if (normalizedKeywords.length === 0) {
      throw new Error('抖音采集缺少关键词');
    }
    console.log(`[douyin] collect start keywordCount=${normalizedKeywords.length} limit=${limit}`);

    const playwright = await this.loadPlaywright();
    const session = await this.openBrowserContext(playwright);
    const context = session.browserContext;

    try {
      const allItems = [];
      const dedup = new Map();
      const perKeywordLimit = Math.max(1, Math.ceil(limit / normalizedKeywords.length));

      for (const keyword of normalizedKeywords) {
        const items = await this.collectByKeyword(context, keyword, perKeywordLimit);
        console.log(`[douyin] keyword collected keyword=${keyword} itemCount=${items.length}`);
        for (const item of items) {
          const key = `douyin:${item.platform_content_id}`;
          if (dedup.has(key)) continue;
          dedup.set(key, item);
          allItems.push(item);
          if (allItems.length >= limit) break;
        }
        if (allItems.length >= limit) break;
      }

      console.log(`[douyin] collect done total=${allItems.length}`);
      return allItems.slice(0, limit);
    } finally {
      await session.close();
    }
  }
}

module.exports = DouyinCollector;

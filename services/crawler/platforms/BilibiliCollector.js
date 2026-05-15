const axios = require('axios');

const { md5, sanitizeNumber, stripHtml, sleep } = require('../utils');

/**
 * B 站采集器。
 * 通过 WBI 搜索接口和详情接口获取视频列表，并转换为统一内容结构。
 */
class BilibiliCollector {
  constructor(options = {}) {
    this.timeout = Number(options.timeoutMs || 15000);
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
    this.http = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com'
      }
    });
    this.mixinTable = [
      46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45,
      35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38,
      41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60,
      51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
      20, 34, 44, 52
    ];
  }

  /**
   * 根据 B 站规则混淆 imgKey/subKey，生成签名盐值。
   */
  getSalt(imgKey, subKey) {
    const mixinKey = `${imgKey}${subKey}`;
    const mixed = this.mixinTable.map(index => mixinKey[index]).join('');
    return mixed.slice(0, 32);
  }

  /**
   * 获取当前 WBI 签名所需的 key。
   */
  async getWbiKeys() {
    const response = await this.http.get('https://api.bilibili.com/x/web-interface/nav');
    const data = response?.data?.data;
    if (!data?.wbi_img?.img_url || !data?.wbi_img?.sub_url) {
      throw new Error('获取 B 站 WBI keys 失败');
    }
    const imgKey = data.wbi_img.img_url.split('/').pop().split('.')[0];
    const subKey = data.wbi_img.sub_url.split('/').pop().split('.')[0];
    return { imgKey, subKey };
  }

  /**
   * 给搜索参数附加 WBI 签名。
   */
  signParams(params, imgKey, subKey) {
    const signed = {
      ...params,
      wts: Math.floor(Date.now() / 1000)
    };
    const sanitized = Object.fromEntries(
      Object.entries(signed)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value).replace(/[!'()*]/g, '')])
    );
    const query = new URLSearchParams(sanitized).toString();
    sanitized.w_rid = md5(query + this.getSalt(imgKey, subKey));
    return sanitized;
  }

  /**
   * 根据关键词调用 B 站搜索接口。
   */
  async searchByKeyword(keyword, page = 1, pageSize = 10) {
    const { imgKey, subKey } = await this.getWbiKeys();
    const params = this.signParams({
      search_type: 'video',
      keyword,
      page,
      page_size: pageSize,
      order: 'totalrank'
    }, imgKey, subKey);

    const response = await this.http.get('https://api.bilibili.com/x/web-interface/wbi/search/type', {
      params
    });
    return response?.data?.data?.result || [];
  }

  /**
   * 获取单个视频的详情信息。
   */
  async getVideoDetail(bvid) {
    const response = await this.http.get('https://api.bilibili.com/x/web-interface/view', {
      params: { bvid }
    });
    return response?.data?.data || null;
  }

  /**
   * 把搜索结果和详情数据归一化成统一内容结构。
   */
  normalizeItem(searchItem, detailItem, keyword) {
    const view = detailItem || {};
    const owner = view.owner || {};
    const stat = view.stat || {};
    const bvid = view.bvid || searchItem.bvid;

    return {
      platform: 'bilibili',
      platform_content_id: bvid,
      content_type: 'video',
      title: stripHtml(view.title || searchItem.title || ''),
      description: stripHtml(view.desc || searchItem.description || ''),
      author_id: owner.mid ? String(owner.mid) : String(searchItem.mid || ''),
      author_name: owner.name || searchItem.author || '',
      author_avatar: owner.face || '',
      cover_url: view.pic || searchItem.pic || '',
      source_url: view.short_link_v2 || (bvid ? `https://www.bilibili.com/video/${bvid}` : ''),
      play_url: null,
      publish_time: Number(view.pubdate || searchItem.pubdate || 0) || null,
      liked_count: sanitizeNumber(stat.like),
      comment_count: sanitizeNumber(stat.reply || searchItem.video_review),
      share_count: sanitizeNumber(stat.share),
      favorite_count: sanitizeNumber(stat.favorite || searchItem.favorites),
      view_count: sanitizeNumber(stat.view || searchItem.play),
      source_keyword: keyword,
      raw_payload: {
        searchItem,
        detailItem
      }
    };
  }

  /**
   * 执行一次 B 站采集任务。
   */
  async collect({ keywords = [], limit = 10 } = {}) {
    const allItems = [];
    const dedup = new Map();
    const normalizedKeywords = keywords.filter(Boolean);
    if (normalizedKeywords.length === 0) {
      throw new Error('B站采集缺少关键词');
    }
    console.log(`[bilibili] collect start keywordCount=${normalizedKeywords.length} limit=${limit}`);

    const perKeywordLimit = Math.max(1, Math.ceil(limit / normalizedKeywords.length));

    for (const keyword of normalizedKeywords) {
      console.log(`[bilibili] keyword start keyword=${keyword} perKeywordLimit=${perKeywordLimit}`);
      let page = 1;
      while (dedup.size < limit) {
        const result = await this.searchByKeyword(keyword, page, Math.min(20, perKeywordLimit));
        console.log(`[bilibili] search page keyword=${keyword} page=${page} resultCount=${Array.isArray(result) ? result.length : 0}`);
        if (!Array.isArray(result) || result.length === 0) {
          break;
        }

        for (const searchItem of result) {
          const bvid = searchItem.bvid;
          if (!bvid || dedup.has(`bilibili:${bvid}`)) continue;
          let detailItem = null;
          try {
            detailItem = await this.getVideoDetail(bvid);
          } catch (error) {
            detailItem = null;
          }
          const item = this.normalizeItem(searchItem, detailItem, keyword);
          dedup.set(`bilibili:${bvid}`, item);
          allItems.push(item);
          if (dedup.size >= limit) break;
          await sleep(200);
        }

        if (result.length < Math.min(20, perKeywordLimit) || dedup.size >= limit) {
          break;
        }
        page += 1;
      }
      console.log(`[bilibili] keyword done keyword=${keyword} dedupCount=${dedup.size}`);
    }

    console.log(`[bilibili] collect done total=${allItems.length}`);
    return allItems.slice(0, limit);
  }
}

module.exports = BilibiliCollector;

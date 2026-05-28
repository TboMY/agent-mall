function buildDouyinAgentPrompt({
  keywords = [],
  limit = 10,
  resultLimitPerKeyword = 10,
  sessionProfile = 'douyin-default'
} = {}) {
  const keywordText = keywords.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return `
你正在执行一个“抖音实时内容采集”任务，必须使用已配置的 chrome-devtools MCP 连接到本机已打开的 Chrome。

任务要求：
1. 访问 https://www.douyin.com/ ，使用当前浏览器已有登录态，不要尝试登录。
2. 按顺序搜索以下关键词，并采集公开视频内容：
${keywordText}
3. 总结果数不超过 ${limit} 条；一旦累计结果达到 ${limit} 条，立即停止，不要继续搜索剩余关键词。
4. 每个关键词最多采集 ${resultLimitPerKeyword} 条，只看搜索结果页优先，不要为了凑满条数反复翻页或深挖历史内容。
5. 只提取公开可见页面中可以直接读取的信息，不要臆造字段。
6. 每条结果尽量返回：
   - platform_content_id
   - title
   - description
   - cover_url（优先从搜索结果卡片或详情弹层中的 img.src、img.currentSrc、video.poster、video 当前封面、style.backgroundImage 中读取；如果页面里存在封面缩略图地址，优先返回该地址）
   - source_url（优先从卡片链接 href、详情页地址栏读取；如果拿到了 platform_content_id 但没拿到链接，就构造 https://www.douyin.com/video/{platform_content_id}）
   - play_url（能直接读取到视频地址就返回；拿不到时允许返回 null）
   - publish_time（秒级时间戳，拿不到时返回 null）
   - liked_count
   - comment_count
   - share_count
   - favorite_count
   - view_count
   - author_id
   - author_name
   - author_avatar
   - content_type（video 或 image_post）
   - source_keyword
7. 如果遇到验证码、安全验证、异常访问、页面不可继续、登录失效、或者无法稳定读取结果，不要尝试绕过，也不要反复重试。
8. 一旦出现上面的阻塞情况，立即返回：
   - success=false
   - code=blocked_verification（或更贴切的阻塞码）
   - message=简短说明
   - items=[]
9. 如果采集成功，返回 success=true，并给出 items。

补充说明：
- session_profile 仅用于日志标识：${sessionProfile}
- 结果中 source_keyword 必须填写命中的搜索关键词。
- 如果 title 为空，使用可见文案补齐；如果 description 为空，至少返回与标题一致的简短描述，不要留空。
- 对于 cover_url，不要只读取一个选择器；应优先尝试卡片封面图、详情弹层首图、video.poster、img.currentSrc 等多个来源，只有都拿不到时才返回 null。
- 返回内容必须严格匹配给定 JSON Schema，不要输出额外解释。
  `.trim();
}

module.exports = buildDouyinAgentPrompt;

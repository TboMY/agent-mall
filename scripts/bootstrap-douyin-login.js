require('dotenv').config();

const readline = require('readline');
const path = require('path');
const CommercialKeyword = require('../models/CommercialKeyword');
const TrendingKeyword = require('../models/TrendingKeyword');

async function waitForEnter(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function resolveKeywordFromSystem() {
  const pickedKeywords = await CommercialKeyword.pickForCollection({
    platform: 'douyin',
    limit: 1
  });
  if (pickedKeywords.length > 0) {
    return String(pickedKeywords[0].keyword || '').trim();
  }

  const recentTrending = await TrendingKeyword.list({
    source: null,
    status: 'pending',
    page: 1,
    limit: 1
  });
  const firstTrending = recentTrending.items?.[0];
  return firstTrending ? String(firstTrending.keyword || '').trim() : '';
}

async function main() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (error) {
    console.error('缺少 playwright 依赖，请先执行 npm install');
    process.exit(1);
  }

  const executablePath = process.env.COLLECTOR_DOUYIN_EXECUTABLE_PATH || undefined;
  const userDataDir = process.env.COLLECTOR_DOUYIN_USER_DATA_DIR
    || path.join(process.cwd(), '.crawler-data', 'douyin');
  const remoteDebuggingPort = Number(process.env.COLLECTOR_DOUYIN_REMOTE_DEBUGGING_PORT || 9222);
  const keywordArgIndex = process.argv.findIndex(arg => arg === '--keyword');
  let keyword = keywordArgIndex >= 0 ? String(process.argv[keywordArgIndex + 1] || '').trim() : '';
  if (!keyword) {
    keyword = await resolveKeywordFromSystem();
  }
  const targetUrl = keyword
    ? `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=general`
    : 'https://www.douyin.com/';

  console.log('[douyin-login] 将打开抖音登录窗口');
  console.log(`[douyin-login] userDataDir=${userDataDir}`);
  if (keyword) {
    console.log(`[douyin-login] 已从系统中选择关键词: ${keyword}`);
  } else {
    console.log('[douyin-login] 当前未从系统中选到关键词，将打开抖音首页。');
  }
  console.log(`[douyin-login] targetUrl=${targetUrl}`);
  console.log('[douyin-login] 请在打开的浏览器中完成登录/验证码验证，完成后回到终端按回车。');

  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false,
    viewport: { width: 1440, height: 960 },
    timeout: 30000,
    args: [`--remote-debugging-port=${remoteDebuggingPort}`]
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await waitForEnter('[douyin-login] 完成登录或验证码验证后按回车保存登录态并关闭浏览器...');
  await context.close();
  console.log('[douyin-login] 登录态/验证状态已保存。后续手动触发/定时任务将继续尝试静默采集。');
}

if (require.main === module) {
  main().catch(error => {
    console.error('[douyin-login] 执行失败:', error.message);
    process.exit(1);
  });
}

module.exports = { main };

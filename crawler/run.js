require('dotenv').config();

const CollectorService = require('../services/crawler/CollectorService');
const { resolveRunInput } = require('../services/crawler/CrawlerConfig');
const { closePools } = require('../config/database');

function parseArgs(argv = []) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    result[key] = value;
    if (value !== true) i += 1;
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {};

  if (args.browser_mode) options.browserMode = args.browser_mode;
  if (args.cdp_url) options.cdpUrl = args.cdp_url;
  if (args.executable_path) options.executablePath = args.executable_path;
  if (args.user_data_dir) options.userDataDir = args.user_data_dir;
  if (args.remote_debugging_port) {
    options.remoteDebuggingPort = Number(args.remote_debugging_port);
  }

  const resolvedInput = resolveRunInput({
    platform: args.platform,
    keywords: args.keywords,
    limit: args.limit ? Number(args.limit) : undefined,
    options
  });

  const result = await CollectorService.collectAndStore({
    ...resolvedInput
  });

  console.log(JSON.stringify({
    success: true,
    platform: result.platform,
    keywords: result.keywords,
    count: result.count,
    sample: result.items.slice(0, 3).map(item => ({
      platform: item.platform,
      platform_content_id: item.platform_content_id,
      title: item.title,
      source_keyword: item.source_keyword
    }))
  }, null, 2));
}

main()
  .catch(error => {
    console.error('[crawler-run] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePools();
  });

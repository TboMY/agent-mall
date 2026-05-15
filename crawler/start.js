require('dotenv').config();

const createCrawlerApp = require('./app');
const { getServerConfig } = require('../services/crawler/CrawlerConfig');

const { host, port } = getServerConfig();
const app = createCrawlerApp();

const server = app.listen(port, host, () => {
  console.log(`Crawler server listening on http://${host}:${port}`);
});

server.on('error', error => {
  if (error?.code === 'EACCES') {
    console.error(`Crawler server 无法监听 ${host}:${port}。这个端口可能被系统保留或当前用户无权限使用。请更换 COLLECTOR_SERVER_PORT。`);
    process.exit(1);
  }

  if (error?.code === 'EADDRINUSE') {
    console.error(`Crawler server 无法监听 ${host}:${port}。端口已被占用，请更换 COLLECTOR_SERVER_PORT。`);
    process.exit(1);
  }

  console.error('[crawler-server] failed:', error);
  process.exit(1);
});

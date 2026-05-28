require('dotenv').config();

const createAgentBridgeApp = require('./agentBridgeApp');

const host = process.env.COLLECTOR_AGENT_BRIDGE_HOST || '127.0.0.1';
const port = Number(process.env.COLLECTOR_AGENT_BRIDGE_PORT || 3188);
const app = createAgentBridgeApp();

const server = app.listen(port, host, () => {
  console.log(`Agent bridge listening on http://${host}:${port}`);
});

server.on('error', error => {
  if (error?.code === 'EACCES') {
    console.error(`Agent bridge 无法监听 ${host}:${port}，请更换 COLLECTOR_AGENT_BRIDGE_PORT。`);
    process.exit(1);
  }

  if (error?.code === 'EADDRINUSE') {
    console.error(`Agent bridge 无法监听 ${host}:${port}，端口已被占用。`);
    process.exit(1);
  }

  console.error('[agent-bridge] failed:', error);
  process.exit(1);
});

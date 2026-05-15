const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

let cachedContext = null;

function resolveSignerPath() {
  const candidates = [
    path.resolve(process.cwd(), 'libs', 'douyin.js'),
    path.resolve(process.cwd(), '..', 'MediaCrawler', 'libs', 'douyin.js')
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  throw new Error('未找到抖音 a_bogus 签名脚本（douyin.js）');
}

function loadSignerContext() {
  if (cachedContext) return cachedContext;

  const signerPath = resolveSignerPath();
  const code = fs.readFileSync(signerPath, 'utf8');
  const context = {
    console,
    Math,
    Date,
    encodeURIComponent,
    decodeURIComponent,
    String,
    Array,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite
  };
  vm.createContext(context);
  vm.runInContext(code, context, {
    filename: signerPath
  });

  if (typeof context.sign_datail !== 'function') {
    throw new Error('抖音签名脚本缺少 sign_datail 函数');
  }

  cachedContext = context;
  return cachedContext;
}

function signSearchParams(params, userAgent) {
  const context = loadSignerContext();
  return context.sign_datail(params, userAgent);
}

function createWebId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 19);
}

module.exports = {
  signSearchParams,
  createWebId
};

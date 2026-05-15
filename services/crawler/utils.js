const crypto = require('crypto');

function sanitizeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).replace(/[^0-9.-]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

function stripHtml(value = '') {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function parseContentRangeTotal(value) {
  const text = String(value || '');
  const matched = text.match(/\/(\d+)$/);
  if (!matched) return null;
  const total = Number(matched[1]);
  return Number.isFinite(total) ? total : null;
}

module.exports = {
  sanitizeNumber,
  stripHtml,
  sleep,
  md5,
  parseContentRangeTotal
};

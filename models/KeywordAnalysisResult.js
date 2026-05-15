const { query } = require('../config/database');

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

class KeywordAnalysisResult {
  static async create(resultData) {
    const sql = `
      INSERT INTO keyword_analysis_results (
        trending_keyword_id, model_name, is_commercial, confidence,
        suggested_category, intent_type, expanded_keywords,
        recommended_platforms, reason, raw_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      resultData.trending_keyword_id,
      resultData.model_name,
      resultData.is_commercial ? 1 : 0,
      resultData.confidence ?? 0,
      resultData.suggested_category || '',
      resultData.intent_type || 'none',
      JSON.stringify(resultData.expanded_keywords || []),
      JSON.stringify(resultData.recommended_platforms || []),
      resultData.reason || '',
      JSON.stringify(resultData.raw_response || {})
    ]);

    return result.insertId;
  }

  static async listByTrendingKeywordId(trendingKeywordId) {
    const sql = `
      SELECT *
      FROM keyword_analysis_results
      WHERE trending_keyword_id = ?
      ORDER BY created_at DESC, id DESC
    `;
    return (await query(sql, [trendingKeywordId])).map(row => ({
      ...row,
      expanded_keywords: parseJson(row.expanded_keywords, []),
      recommended_platforms: parseJson(row.recommended_platforms, []),
      raw_response: parseJson(row.raw_response, {})
    }));
  }
}

module.exports = KeywordAnalysisResult;

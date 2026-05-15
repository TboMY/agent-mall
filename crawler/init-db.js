require('dotenv').config();

const mysql = require('mysql2/promise');

const createSourceContentItemsSql = `
CREATE TABLE IF NOT EXISTS source_content_items (
  id bigint NOT NULL AUTO_INCREMENT,
  platform varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '来源平台: douyin | bilibili',
  platform_content_id varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台内容ID，如抖音 aweme_id、B站 bvid',
  content_type varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'video' COMMENT '内容类型',
  title varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '标题',
  description text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '描述/文案',
  author_id varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '作者ID',
  author_name varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '作者昵称',
  author_avatar text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '作者头像',
  cover_url text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '封面图',
  source_url text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '原始内容链接',
  play_url text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '可直接用于分析或播放的媒体链接',
  publish_time bigint NULL DEFAULT NULL COMMENT '发布时间（秒级时间戳）',
  liked_count bigint NULL DEFAULT 0 COMMENT '点赞数',
  comment_count bigint NULL DEFAULT 0 COMMENT '评论数',
  share_count bigint NULL DEFAULT 0 COMMENT '分享数',
  favorite_count bigint NULL DEFAULT 0 COMMENT '收藏数',
  view_count bigint NULL DEFAULT 0 COMMENT '播放/浏览数',
  source_keyword varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '来源关键词',
  analysis_status tinyint NOT NULL DEFAULT 0 COMMENT '分析状态: 0=待分析, 1=分析中, 2=已分析, 3=分析失败, 4=已跳过',
  analysis_attempts int NOT NULL DEFAULT 0 COMMENT '分析尝试次数',
  analysis_error text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '最近一次分析错误',
  last_collected_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近采集时间',
  last_analyzed_at datetime NULL DEFAULT NULL COMMENT '最近分析时间',
  raw_payload json NULL COMMENT '原始平台返回数据',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id) USING BTREE,
  UNIQUE KEY uk_platform_content_id (platform, platform_content_id),
  KEY idx_platform_analysis_status (platform, analysis_status, publish_time),
  KEY idx_source_keyword (source_keyword),
  KEY idx_last_collected_at (last_collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采集到的平台内容表';
`;

const createCrawlerRunsSql = `
CREATE TABLE IF NOT EXISTS crawler_collection_runs (
  id bigint NOT NULL AUTO_INCREMENT,
  platform varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '采集平台',
  keywords text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '本次采集关键词',
  limit_count int NOT NULL DEFAULT 0 COMMENT '目标采集数量',
  status varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'running' COMMENT '运行状态: running | success | failed',
  collected_count int NOT NULL DEFAULT 0 COMMENT '实际采集数量',
  error_message text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '失败原因',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  finished_at datetime NULL DEFAULT NULL COMMENT '完成时间',
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id) USING BTREE,
  KEY idx_platform_created_at (platform, created_at),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采集任务运行日志表';
`;

const createTrendingKeywordsSql = `
CREATE TABLE IF NOT EXISTS trending_keywords (
  id bigint NOT NULL AUTO_INCREMENT,
  source varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'manual' COMMENT '来源: manual | douyin | bilibili | baidu',
  keyword varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '原始热点词',
  raw_rank int NULL DEFAULT NULL COMMENT '原始排名',
  raw_score varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '原始热度值',
  snapshot_time datetime NULL DEFAULT NULL COMMENT '热点快照时间',
  status varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending' COMMENT '状态: pending | analyzed | discarded',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_source_status_created_at (source, status, created_at),
  KEY idx_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='原始热点关键词表';
`;

const createKeywordAnalysisResultsSql = `
CREATE TABLE IF NOT EXISTS keyword_analysis_results (
  id bigint NOT NULL AUTO_INCREMENT,
  trending_keyword_id bigint NOT NULL COMMENT '关联 trending_keywords.id',
  model_name varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分析模型名',
  is_commercial tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否具备商业价值',
  confidence decimal(5,4) NOT NULL DEFAULT 0 COMMENT '置信度',
  suggested_category varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '建议类目',
  intent_type varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'none' COMMENT '意图类型',
  expanded_keywords json NULL COMMENT '扩展采集词',
  recommended_platforms json NULL COMMENT '推荐采集平台',
  reason text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '分析理由',
  raw_response json NULL COMMENT '原始模型响应',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_trending_keyword_created_at (trending_keyword_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='热点关键词分析结果表';
`;

const createCommercialKeywordsSql = `
CREATE TABLE IF NOT EXISTS commercial_keywords (
  id bigint NOT NULL AUTO_INCREMENT,
  keyword varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '可用于采集的商业关键词',
  source_keyword_id bigint NULL DEFAULT NULL COMMENT '来源热点词ID',
  source varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'manual' COMMENT '来源',
  category varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '建议类目',
  priority int NOT NULL DEFAULT 50 COMMENT '优先级',
  platforms json NULL COMMENT '建议采集平台',
  confidence decimal(5,4) NOT NULL DEFAULT 0 COMMENT '置信度',
  reason text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '保留原因',
  status varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'active' COMMENT '状态: active | paused',
  collect_count int NOT NULL DEFAULT 0 COMMENT '被采集使用次数',
  attempt_count int NOT NULL DEFAULT 0 COMMENT '被调度尝试次数（包含失败）',
  first_collected_at datetime NULL DEFAULT NULL COMMENT '首次被采集时间',
  last_collected_at datetime NULL DEFAULT NULL COMMENT '最近一次被采集时间',
  last_attempted_at datetime NULL DEFAULT NULL COMMENT '最近一次被调度尝试时间',
  last_attempt_status varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '最近一次调度结果: running | success | failed',
  last_collected_platform varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '最近一次采集的平台',
  valid_until datetime NULL DEFAULT NULL COMMENT '有效期',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_keyword (keyword),
  KEY idx_status_priority_updated_at (status, priority, updated_at),
  KEY idx_collect_schedule (status, collect_count, last_collected_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商业关键词池';
`;

async function columnExists(connection, tableName, columnName, databaseName) {
  const [rows] = await connection.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = ?
      AND table_name = ?
      AND column_name = ?
    LIMIT 1
  `, [databaseName, tableName, columnName]);
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName, databaseName) {
  const [rows] = await connection.query(`
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = ?
      AND table_name = ?
      AND index_name = ?
    LIMIT 1
  `, [databaseName, tableName, indexName]);
  return rows.length > 0;
}

async function main() {
  const database = process.env.DB_NAME || 'agent-mall';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database
  });

  try {
    await connection.query(createSourceContentItemsSql);
    await connection.query(createCrawlerRunsSql);
    await connection.query(createTrendingKeywordsSql);
    await connection.query(createKeywordAnalysisResultsSql);
    await connection.query(createCommercialKeywordsSql);
    await connection.query(`
      ALTER TABLE ai_product_candidate
      MODIFY COLUMN aweme_id bigint NULL COMMENT '历史字段，兼容旧版抖音作品ID'
    `);

    const columns = [
      ['source_content_id', "ALTER TABLE ai_product_candidate ADD COLUMN source_content_id bigint NULL COMMENT '关联 source_content_items.id' AFTER aweme_id"],
      ['source_platform', "ALTER TABLE ai_product_candidate ADD COLUMN source_platform varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '来源平台' AFTER source_content_id"],
      ['platform_content_id', "ALTER TABLE ai_product_candidate ADD COLUMN platform_content_id varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '平台内容ID' AFTER source_platform"],
      ['content_type', "ALTER TABLE ai_product_candidate ADD COLUMN content_type varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'video' COMMENT '内容类型' AFTER platform_content_id"]
    ];

    for (const [columnName, sql] of columns) {
      if (!(await columnExists(connection, 'ai_product_candidate', columnName, database))) {
        await connection.query(sql);
      }
    }

    const commercialKeywordColumns = [
      ['collect_count', "ALTER TABLE commercial_keywords ADD COLUMN collect_count int NOT NULL DEFAULT 0 COMMENT '被采集使用次数' AFTER status"],
      ['attempt_count', "ALTER TABLE commercial_keywords ADD COLUMN attempt_count int NOT NULL DEFAULT 0 COMMENT '被调度尝试次数（包含失败）' AFTER collect_count"],
      ['first_collected_at', "ALTER TABLE commercial_keywords ADD COLUMN first_collected_at datetime NULL DEFAULT NULL COMMENT '首次被采集时间' AFTER collect_count"],
      ['last_collected_at', "ALTER TABLE commercial_keywords ADD COLUMN last_collected_at datetime NULL DEFAULT NULL COMMENT '最近一次被采集时间' AFTER first_collected_at"],
      ['last_attempted_at', "ALTER TABLE commercial_keywords ADD COLUMN last_attempted_at datetime NULL DEFAULT NULL COMMENT '最近一次被调度尝试时间' AFTER last_collected_at"],
      ['last_attempt_status', "ALTER TABLE commercial_keywords ADD COLUMN last_attempt_status varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '最近一次调度结果: running | success | failed' AFTER last_attempted_at"],
      ['last_collected_platform', "ALTER TABLE commercial_keywords ADD COLUMN last_collected_platform varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '最近一次采集的平台' AFTER last_collected_at"]
    ];
    for (const [columnName, sql] of commercialKeywordColumns) {
      if (!(await columnExists(connection, 'commercial_keywords', columnName, database))) {
        await connection.query(sql);
      }
    }

    if (!(await indexExists(connection, 'ai_product_candidate', 'uk_ai_candidate_source_content_id', database))) {
      await connection.query('CREATE UNIQUE INDEX uk_ai_candidate_source_content_id ON ai_product_candidate (source_content_id)');
    }

    if (!(await indexExists(connection, 'ai_product_candidate', 'idx_ai_candidate_source_platform', database))) {
      await connection.query('CREATE INDEX idx_ai_candidate_source_platform ON ai_product_candidate (source_platform, status, hot_score)');
    }

    if (!(await indexExists(connection, 'commercial_keywords', 'idx_collect_schedule', database))) {
      await connection.query('CREATE INDEX idx_collect_schedule ON commercial_keywords (status, collect_count, last_collected_at, created_at)');
    }

    console.log('Crawler schema initialized successfully.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('[crawler-init-db] failed:', error);
  process.exitCode = 1;
});

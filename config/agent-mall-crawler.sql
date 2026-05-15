SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `source_content_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '来源平台: douyin | bilibili',
  `platform_content_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '平台内容ID，如抖音 aweme_id、B站 bvid',
  `content_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'video' COMMENT '内容类型',
  `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '描述/文案',
  `author_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '作者ID',
  `author_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '作者昵称',
  `author_avatar` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '作者头像',
  `cover_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '封面图',
  `source_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '原始内容链接',
  `play_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '可直接用于分析或播放的媒体链接',
  `publish_time` bigint NULL DEFAULT NULL COMMENT '发布时间（秒级时间戳）',
  `liked_count` bigint NULL DEFAULT 0 COMMENT '点赞数',
  `comment_count` bigint NULL DEFAULT 0 COMMENT '评论数',
  `share_count` bigint NULL DEFAULT 0 COMMENT '分享数',
  `favorite_count` bigint NULL DEFAULT 0 COMMENT '收藏数',
  `view_count` bigint NULL DEFAULT 0 COMMENT '播放/浏览数',
  `source_keyword` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '来源关键词',
  `analysis_status` tinyint NOT NULL DEFAULT 0 COMMENT '分析状态: 0=待分析, 1=分析中, 2=已分析, 3=分析失败, 4=已跳过',
  `analysis_attempts` int NOT NULL DEFAULT 0 COMMENT '分析尝试次数',
  `analysis_error` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '最近一次分析错误',
  `last_collected_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近采集时间',
  `last_analyzed_at` datetime NULL DEFAULT NULL COMMENT '最近分析时间',
  `raw_payload` json NULL COMMENT '原始平台返回数据',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_platform_content_id`(`platform` ASC, `platform_content_id` ASC) USING BTREE,
  INDEX `idx_platform_analysis_status`(`platform` ASC, `analysis_status` ASC, `publish_time` DESC) USING BTREE,
  INDEX `idx_source_keyword`(`source_keyword` ASC) USING BTREE,
  INDEX `idx_last_collected_at`(`last_collected_at` DESC) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采集到的平台内容表' ROW_FORMAT=Dynamic;

CREATE TABLE IF NOT EXISTS `crawler_collection_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '采集平台',
  `keywords` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '本次采集关键词',
  `limit_count` int NOT NULL DEFAULT 0 COMMENT '目标采集数量',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'running' COMMENT '运行状态: running | success | failed',
  `collected_count` int NOT NULL DEFAULT 0 COMMENT '实际采集数量',
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '失败原因',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `finished_at` datetime NULL DEFAULT NULL COMMENT '完成时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_platform_created_at`(`platform` ASC, `created_at` DESC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='采集任务运行日志表' ROW_FORMAT=Dynamic;

CREATE TABLE IF NOT EXISTS `trending_keywords` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'manual' COMMENT '来源: manual | douyin | bilibili | baidu',
  `keyword` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '原始热点词',
  `raw_rank` int NULL DEFAULT NULL COMMENT '原始排名',
  `raw_score` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '原始热度值',
  `snapshot_time` datetime NULL DEFAULT NULL COMMENT '热点快照时间',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending' COMMENT '状态: pending | analyzed | discarded',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_source_status_created_at`(`source` ASC, `status` ASC, `created_at` DESC) USING BTREE,
  INDEX `idx_keyword`(`keyword` ASC) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='原始热点关键词表' ROW_FORMAT=Dynamic;

CREATE TABLE IF NOT EXISTS `keyword_analysis_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `trending_keyword_id` bigint NOT NULL COMMENT '关联 trending_keywords.id',
  `model_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分析模型名',
  `is_commercial` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否具备商业价值',
  `confidence` decimal(5,4) NOT NULL DEFAULT 0 COMMENT '置信度',
  `suggested_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '建议类目',
  `intent_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'none' COMMENT '意图类型',
  `expanded_keywords` json NULL COMMENT '扩展采集词',
  `recommended_platforms` json NULL COMMENT '推荐采集平台',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '分析理由',
  `raw_response` json NULL COMMENT '原始模型响应',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_trending_keyword_created_at`(`trending_keyword_id` ASC, `created_at` DESC) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='热点关键词分析结果表' ROW_FORMAT=Dynamic;

CREATE TABLE IF NOT EXISTS `commercial_keywords` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `keyword` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '可用于采集的商业关键词',
  `source_keyword_id` bigint NULL DEFAULT NULL COMMENT '来源热点词ID',
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'manual' COMMENT '来源',
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '建议类目',
  `priority` int NOT NULL DEFAULT 50 COMMENT '优先级',
  `platforms` json NULL COMMENT '建议采集平台',
  `confidence` decimal(5,4) NOT NULL DEFAULT 0 COMMENT '置信度',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '保留原因',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'active' COMMENT '状态: active | paused',
  `collect_count` int NOT NULL DEFAULT 0 COMMENT '被采集使用次数',
  `first_collected_at` datetime NULL DEFAULT NULL COMMENT '首次被采集时间',
  `last_collected_at` datetime NULL DEFAULT NULL COMMENT '最近一次被采集时间',
  `last_collected_platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '最近一次采集的平台',
  `valid_until` datetime NULL DEFAULT NULL COMMENT '有效期',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_keyword`(`keyword` ASC) USING BTREE,
  INDEX `idx_status_priority_updated_at`(`status` ASC, `priority` DESC, `updated_at` DESC) USING BTREE,
  INDEX `idx_collect_schedule`(`status` ASC, `collect_count` ASC, `last_collected_at` ASC, `created_at` ASC) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='商业关键词池' ROW_FORMAT=Dynamic;

ALTER TABLE `ai_product_candidate`
  MODIFY COLUMN `aweme_id` bigint NULL COMMENT '历史字段，兼容旧版抖音作品ID';

ALTER TABLE `ai_product_candidate`
  ADD COLUMN IF NOT EXISTS `source_content_id` bigint NULL COMMENT '关联 source_content_items.id' AFTER `aweme_id`,
  ADD COLUMN IF NOT EXISTS `source_platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '来源平台' AFTER `source_content_id`,
  ADD COLUMN IF NOT EXISTS `platform_content_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '平台内容ID' AFTER `source_platform`,
  ADD COLUMN IF NOT EXISTS `content_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'video' COMMENT '内容类型' AFTER `platform_content_id`;

CREATE UNIQUE INDEX `uk_ai_candidate_source_content_id`
  ON `ai_product_candidate` (`source_content_id`);

CREATE INDEX `idx_ai_candidate_source_platform`
  ON `ai_product_candidate` (`source_platform`, `status`, `hot_score`);

SET FOREIGN_KEY_CHECKS = 1;

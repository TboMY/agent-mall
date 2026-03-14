-- 初始化AI工作台默认配置
INSERT INTO system_configs (config_key, config_value, config_type, description, group_name) VALUES
-- 定时任务配置
('scheduled_task_enabled', 'true', 'boolean', '定时任务是否启用', 'ai_workbench'),
('scheduled_task_product_count', '50', 'number', '定时任务推送商品数量', 'ai_workbench'),
('scheduled_task_execution_time', '00:00', 'string', '定时任务执行时间', 'ai_workbench'),
('scheduled_task_platforms', '["bilibili", "douyin", "xiaohongshu"]', 'json', '定时任务数据来源平台', 'ai_workbench'),

-- 手动触发配置
('manual_trigger_product_count', '10', 'number', '手动触发推送商品数量', 'ai_workbench'),
('manual_trigger_platforms', '["bilibili", "douyin"]', 'json', '手动触发数据来源平台', 'ai_workbench'),

-- AI模型配置
('ai_recommendation_threshold', '70', 'number', 'AI推荐阈值（百分比）', 'ai_workbench'),
('ai_recommendation_strategy', 'viral_priority', 'string', 'AI推荐策略', 'ai_workbench')

ON DUPLICATE KEY UPDATE
config_value = VALUES(config_value),
config_type = VALUES(config_type),
description = VALUES(description),
group_name = VALUES(group_name),
updated_at = NOW();

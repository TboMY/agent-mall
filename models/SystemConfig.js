const { query } = require('../config/database');

class SystemConfig {
  // 获取所有配置
  static async getAll() {
    const sql = 'SELECT * FROM system_configs ORDER BY group_name, id';
    return await query(sql, []);
  }

  // 根据分组获取配置
  static async getByGroup(groupName) {
    const sql = 'SELECT * FROM system_configs WHERE group_name = ? ORDER BY id';
    return await query(sql, [groupName]);
  }

  // 根据键获取配置
  static async getByKey(configKey) {
    const sql = 'SELECT * FROM system_configs WHERE config_key = ?';
    const [config] = await query(sql, [configKey]);
    return config;
  }

  // 获取配置值（自动类型转换）
  static async getValue(configKey, defaultValue = null) {
    const config = await this.getByKey(configKey);
    if (!config) return defaultValue;

    // 根据类型转换值
    switch (config.config_type) {
      case 'number':
        return Number(config.config_value);
      case 'boolean':
        return config.config_value === 'true' || config.config_value === '1';
      case 'json':
        try {
          return JSON.parse(config.config_value);
        } catch (e) {
          return defaultValue;
        }
      default:
        return config.config_value;
    }
  }

  // 设置配置值
  static async setValue(configKey, value, configType = 'string', description = '', groupName = 'general') {
    let configValue = value;
    
    // 根据类型转换值
    switch (configType) {
      case 'number':
        configValue = String(Number(value));
        break;
      case 'boolean':
        configValue = value ? 'true' : 'false';
        break;
      case 'json':
        configValue = JSON.stringify(value);
        break;
      default:
        configValue = String(value);
    }

    const sql = `
      INSERT INTO system_configs (config_key, config_value, config_type, description, group_name)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      config_value = VALUES(config_value),
      config_type = VALUES(config_type),
      description = VALUES(description),
      group_name = VALUES(group_name),
      updated_at = NOW()
    `;
    
    const result = await query(sql, [configKey, configValue, configType, description, groupName]);
    return result.affectedRows > 0;
  }

  // 批量设置配置
  static async setBatch(configs) {
    const results = [];
    for (const config of configs) {
      const result = await this.setValue(
        config.key,
        config.value,
        config.type || 'string',
        config.description || '',
        config.group || 'general'
      );
      results.push({ key: config.key, success: result });
    }
    return results;
  }

  // 删除配置
  static async deleteByKey(configKey) {
    const sql = 'DELETE FROM system_configs WHERE config_key = ?';
    const result = await query(sql, [configKey]);
    return result.affectedRows > 0;
  }

  // 获取AI工作台配置
  static async getAIWorkbenchConfig() {
    const configs = await this.getByGroup('ai_workbench');
    const result = {
      scheduledTask: {
        enabled: true,
        productCount: 15,
        executionTime: '00:00',
        platforms: ['bilibili', 'douyin', 'xiaohongshu']
      },
      manualTrigger: {
        productCount: 7,
        platforms: ['bilibili', 'douyin']
      },
      aiModel: {
        recommendationThreshold: 70,
        recommendationStrategy: 'viral_priority'
      },
      crawlerState: {
        lastAwemeRowId: 0
      }
    };

    // 从数据库配置覆盖默认值
    for (const config of configs) {
      const value = await this.getValue(config.config_key);
      
      switch (config.config_key) {
        case 'scheduled_task_enabled':
          result.scheduledTask.enabled = value;
          break;
        case 'scheduled_task_product_count':
          result.scheduledTask.productCount = value;
          break;
        case 'scheduled_task_execution_time':
          result.scheduledTask.executionTime = value;
          break;
        case 'scheduled_task_platforms':
          result.scheduledTask.platforms = value;
          break;
        case 'manual_trigger_product_count':
          result.manualTrigger.productCount = value;
          break;
        case 'manual_trigger_platforms':
          result.manualTrigger.platforms = value;
          break;
        case 'ai_recommendation_threshold':
          result.aiModel.recommendationThreshold = value;
          break;
        case 'ai_recommendation_strategy':
          result.aiModel.recommendationStrategy = value;
          break;
        case 'crawler_last_aweme_row_id':
          result.crawlerState.lastAwemeRowId = Number(value || 0);
          break;
      }
    }

    return result;
  }

  // 保存AI工作台配置
  static async saveAIWorkbenchConfig(config) {
    const configs = [
      { key: 'scheduled_task_enabled', value: config.scheduledTask.enabled, type: 'boolean', description: '定时任务是否启用', group: 'ai_workbench' },
      { key: 'scheduled_task_product_count', value: config.scheduledTask.productCount, type: 'number', description: '定时任务推送商品数量', group: 'ai_workbench' },
      { key: 'scheduled_task_execution_time', value: config.scheduledTask.executionTime, type: 'string', description: '定时任务执行时间', group: 'ai_workbench' },
      { key: 'scheduled_task_platforms', value: config.scheduledTask.platforms, type: 'json', description: '定时任务数据来源平台', group: 'ai_workbench' },
      { key: 'manual_trigger_product_count', value: config.manualTrigger.productCount, type: 'number', description: '手动触发推送商品数量', group: 'ai_workbench' },
      { key: 'manual_trigger_platforms', value: config.manualTrigger.platforms, type: 'json', description: '手动触发数据来源平台', group: 'ai_workbench' },
      { key: 'ai_recommendation_threshold', value: config.aiModel.recommendationThreshold, type: 'number', description: 'AI推荐阈值', group: 'ai_workbench' },
      { key: 'ai_recommendation_strategy', value: config.aiModel.recommendationStrategy, type: 'string', description: 'AI推荐策略', group: 'ai_workbench' },
      { key: 'crawler_last_aweme_row_id', value: config.crawlerState?.lastAwemeRowId ?? 0, type: 'number', description: '爬虫库上次消费的最后一条ID', group: 'ai_workbench' }
    ];

    return await this.setBatch(configs);
  }
}

module.exports = SystemConfig;

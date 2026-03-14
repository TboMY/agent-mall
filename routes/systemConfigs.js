const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const Scheduler = require('../services/Scheduler');

// 获取所有配置
router.get('/', async (req, res) => {
  try {
    const configs = await SystemConfig.getAll();
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统配置失败',
      error: error.message
    });
  }
});

// 根据分组获取配置
router.get('/group/:groupName', async (req, res) => {
  try {
    const { groupName } = req.params;
    const configs = await SystemConfig.getByGroup(groupName);
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('获取分组配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分组配置失败',
      error: error.message
    });
  }
});

// 获取AI工作台配置
router.get('/ai-workbench', async (req, res) => {
  try {
    const config = await SystemConfig.getAIWorkbenchConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取AI工作台配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取AI工作台配置失败',
      error: error.message
    });
  }
});

// 保存AI工作台配置
router.post('/ai-workbench', async (req, res) => {
  try {
    const config = req.body;
    const results = await SystemConfig.saveAIWorkbenchConfig(config);
    // 配置变更后，重置定时任务：删除未执行的并重新安排
    if (Scheduler && Scheduler.reset) {
      await Scheduler.reset();
    }
    
    res.json({
      success: true,
      message: 'AI工作台配置保存成功',
      data: results
    });
  } catch (error) {
    console.error('保存AI工作台配置失败:', error);
    res.status(500).json({
      success: false,
      message: '保存AI工作台配置失败',
      error: error.message
    });
  }
});

// 获取单个配置
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const config = await SystemConfig.getByKey(key);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: '配置不存在'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败',
      error: error.message
    });
  }
});

// 设置配置
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, type = 'string', description = '', group = 'general' } = req.body;
    
    const success = await SystemConfig.setValue(key, value, type, description, group);
    
    if (success) {
      res.json({
        success: true,
        message: '配置保存成功'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '配置保存失败'
      });
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    res.status(500).json({
      success: false,
      message: '保存配置失败',
      error: error.message
    });
  }
});

// 删除配置
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const success = await SystemConfig.deleteByKey(key);
    
    if (success) {
      res.json({
        success: true,
        message: '配置删除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '配置不存在'
      });
    }
  } catch (error) {
    console.error('删除配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除配置失败',
      error: error.message
    });
  }
});

module.exports = router;

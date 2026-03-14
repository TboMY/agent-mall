const express = require('express');
const router = express.Router();
const ProductType = require('../models/ProductType');
const ProductAttribute = require('../models/ProductAttribute');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// 验证规则
const productTypeSchema = Joi.object({
  name: Joi.string().max(100).required().messages({
    'string.empty': '商品类型名称不能为空',
    'string.max': '商品类型名称不能超过100个字符'
  }),
  description: Joi.string().allow('').optional(),
  icon: Joi.string().allow('').optional(),
  sort_order: Joi.number().integer().min(0).default(0),
  status: Joi.number().integer().valid(0, 1).default(1)
});

// 获取商品类型列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const options = { page, limit, search, status };
    
    const types = await ProductType.getAll(options);
    
    res.json({
      success: true,
      data: types,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: types.length
      }
    });
  } catch (error) {
    console.error('获取商品类型列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品类型列表失败',
      error: error.message
    });
  }
});

// 获取启用的商品类型列表（用于下拉选择）
router.get('/active', async (req, res) => {
  try {
    const types = await ProductType.getActiveList();
    
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error('获取启用商品类型列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取启用商品类型列表失败',
      error: error.message
    });
  }
});

// 根据ID获取商品类型
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const type = await ProductType.getById(id);
    
    if (!type) {
      return res.status(404).json({
        success: false,
        message: '商品类型不存在'
      });
    }
    
    // 获取该类型的属性列表
    const attributes = await ProductType.getAttributes(id);
    type.attributes = attributes;
    
    res.json({
      success: true,
      data: type
    });
  } catch (error) {
    console.error('获取商品类型失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品类型失败',
      error: error.message
    });
  }
});

// 创建商品类型
router.post('/', validate(productTypeSchema), async (req, res) => {
  try {
    const typeId = await ProductType.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '商品类型创建成功',
      data: { id: typeId }
    });
  } catch (error) {
    console.error('创建商品类型失败:', error);
    res.status(500).json({
      success: false,
      message: '创建商品类型失败',
      error: error.message
    });
  }
});

// 更新商品类型
router.put('/:id', validate(productTypeSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const success = await ProductType.update(id, req.body);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '商品类型不存在'
      });
    }
    
    res.json({
      success: true,
      message: '商品类型更新成功'
    });
  } catch (error) {
    console.error('更新商品类型失败:', error);
    res.status(500).json({
      success: false,
      message: '更新商品类型失败',
      error: error.message
    });
  }
});

// 删除商品类型
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await ProductType.delete(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '商品类型不存在'
      });
    }
    
    res.json({
      success: true,
      message: '商品类型删除成功'
    });
  } catch (error) {
    console.error('删除商品类型失败:', error);
    res.status(500).json({
      success: false,
      message: '删除商品类型失败',
      error: error.message
    });
  }
});

// 获取商品类型的属性列表
router.get('/:id/attributes', async (req, res) => {
  try {
    const { id } = req.params;
    const attributes = await ProductType.getAttributes(id);
    
    res.json({
      success: true,
      data: attributes
    });
  } catch (error) {
    console.error('获取商品类型属性失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品类型属性失败',
      error: error.message
    });
  }
});

module.exports = router;

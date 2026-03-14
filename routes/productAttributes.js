const express = require('express');
const router = express.Router();
const ProductAttribute = require('../models/ProductAttribute');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// 验证规则
const productAttributeSchema = Joi.object({
  product_type_id: Joi.number().integer().required().messages({
    'any.required': '商品类型ID不能为空'
  }),
  name: Joi.string().max(100).required().messages({
    'string.empty': '属性名称不能为空',
    'string.max': '属性名称不能超过100个字符'
  }),
  attribute_key: Joi.string().max(100).required().messages({
    'string.empty': '属性键名不能为空',
    'string.max': '属性键名不能超过100个字符'
  }),
  description: Joi.string().allow('').optional(),
  value_type: Joi.string().valid('single', 'multiple', 'custom').default('single'),
  is_required: Joi.number().integer().valid(0, 1).default(0),
  sort_order: Joi.number().integer().min(0).default(0),
  status: Joi.number().integer().valid(0, 1).default(1),
  // 允许携带属性值数组（前端只传label即可）
  values: Joi.array().items(
    Joi.alternatives().try(
      Joi.string().max(255),
      Joi.object({
        label: Joi.string().max(255).required(),
        value: Joi.string().allow('').optional(),
        color: Joi.string().allow('').optional(),
        image: Joi.string().allow('').optional(),
        sort_order: Joi.number().integer().min(0).optional(),
        status: Joi.number().integer().valid(0,1).optional()
      })
    )
  ).optional()
});

const attributeValueSchema = Joi.object({
  value: Joi.string().max(255).required().messages({
    'string.empty': '属性值不能为空',
    'string.max': '属性值不能超过255个字符'
  }),
  label: Joi.string().allow('').optional(),
  color: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),
  sort_order: Joi.number().integer().min(0).default(0),
  status: Joi.number().integer().valid(0, 1).default(1)
});

// 获取属性列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', product_type_id, status } = req.query;
    const options = { page, limit, search, product_type_id, status };
    
    const attributes = await ProductAttribute.getAll(options);
    
    res.json({
      success: true,
      data: attributes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: attributes.length
      }
    });
  } catch (error) {
    console.error('获取属性列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取属性列表失败',
      error: error.message
    });
  }
});

// 根据ID获取属性
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const attribute = await ProductAttribute.getById(id);
    
    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: '属性不存在'
      });
    }
    
    // 获取属性值列表
    const values = await ProductAttribute.getValues(id);
    attribute.values = values;
    
    res.json({
      success: true,
      data: attribute
    });
  } catch (error) {
    console.error('获取属性失败:', error);
    res.status(500).json({
      success: false,
      message: '获取属性失败',
      error: error.message
    });
  }
});

// 创建属性
router.post('/', validate(productAttributeSchema), async (req, res) => {
  try {
    const { values, ...attributeData } = req.body;
    const attributeId = await ProductAttribute.create(attributeData);
    
    // 如果有属性值，批量创建
    if (values && values.length > 0) {
      const valuesData = values.map((v, index) => {
        if (typeof v === 'string') {
          return { value: v, label: v, sort_order: index + 1 }
        } else {
          const val = (v.value && String(v.value).trim()) || (v.label && String(v.label).trim()) || ''
          const label = (v.label && String(v.label).trim()) || val
          return { value: val, label, color: v.color, image: v.image, sort_order: v.sort_order || index + 1, status: v.status }
        }
      });
      await ProductAttribute.createValues(attributeId, valuesData);
    }
    
    res.status(201).json({
      success: true,
      message: '属性创建成功',
      data: { id: attributeId }
    });
  } catch (error) {
    console.error('创建属性失败:', error);
    res.status(500).json({
      success: false,
      message: '创建属性失败',
      error: error.message
    });
  }
});

// 更新属性
router.put('/:id', validate(productAttributeSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { values, ...attributeData } = req.body;
    
    const success = await ProductAttribute.update(id, attributeData);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '属性不存在'
      });
    }
    
    // 如果有属性值，先删除旧的，再创建新的
    if (values && values.length > 0) {
      // 删除现有属性值
      const existingValues = await ProductAttribute.getValues(id);
      for (const value of existingValues) {
        await ProductAttribute.deleteValue(value.id);
      }
      
      // 创建新的属性值（兼容字符串或对象）
      const valuesData = values.map((v, index) => {
        if (typeof v === 'string') {
          return { value: v, label: v, sort_order: index + 1 }
        } else {
          const val = (v.value && String(v.value).trim()) || (v.label && String(v.label).trim()) || ''
          const label = (v.label && String(v.label).trim()) || val
          return { value: val, label, color: v.color, image: v.image, sort_order: v.sort_order || index + 1, status: v.status }
        }
      });
      await ProductAttribute.createValues(id, valuesData);
    }
    
    res.json({
      success: true,
      message: '属性更新成功'
    });
  } catch (error) {
    console.error('更新属性失败:', error);
    res.status(500).json({
      success: false,
      message: '更新属性失败',
      error: error.message
    });
  }
});

// 删除属性
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await ProductAttribute.delete(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '属性不存在'
      });
    }
    
    res.json({
      success: true,
      message: '属性删除成功'
    });
  } catch (error) {
    console.error('删除属性失败:', error);
    res.status(500).json({
      success: false,
      message: '删除属性失败',
      error: error.message
    });
  }
});

// 获取属性值列表
router.get('/:id/values', async (req, res) => {
  try {
    const { id } = req.params;
    const values = await ProductAttribute.getValues(id);
    
    res.json({
      success: true,
      data: values
    });
  } catch (error) {
    console.error('获取属性值失败:', error);
    res.status(500).json({
      success: false,
      message: '获取属性值失败',
      error: error.message
    });
  }
});

// 创建属性值
router.post('/:id/values', validate(attributeValueSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const valueId = await ProductAttribute.createValues(id, [req.body]);
    
    res.status(201).json({
      success: true,
      message: '属性值创建成功',
      data: { id: valueId }
    });
  } catch (error) {
    console.error('创建属性值失败:', error);
    res.status(500).json({
      success: false,
      message: '创建属性值失败',
      error: error.message
    });
  }
});

// 更新属性值
router.put('/values/:valueId', validate(attributeValueSchema), async (req, res) => {
  try {
    const { valueId } = req.params;
    const success = await ProductAttribute.updateValue(valueId, req.body);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '属性值不存在'
      });
    }
    
    res.json({
      success: true,
      message: '属性值更新成功'
    });
  } catch (error) {
    console.error('更新属性值失败:', error);
    res.status(500).json({
      success: false,
      message: '更新属性值失败',
      error: error.message
    });
  }
});

// 删除属性值
router.delete('/values/:valueId', async (req, res) => {
  try {
    const { valueId } = req.params;
    const success = await ProductAttribute.deleteValue(valueId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '属性值不存在'
      });
    }
    
    res.json({
      success: true,
      message: '属性值删除成功'
    });
  } catch (error) {
    console.error('删除属性值失败:', error);
    res.status(500).json({
      success: false,
      message: '删除属性值失败',
      error: error.message
    });
  }
});

// 根据商品类型获取属性
router.get('/type/:productTypeId', async (req, res) => {
  try {
    const { productTypeId } = req.params;
    const attributes = await ProductAttribute.getByProductType(productTypeId);
    
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

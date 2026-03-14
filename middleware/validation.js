const Joi = require('joi');

// 商品验证规则
const productSchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    'string.empty': '商品名称不能为空',
    'string.min': '商品名称至少1个字符',
    'string.max': '商品名称不能超过255个字符'
  }),
  description: Joi.string().allow('').max(1000).messages({
    'string.max': '商品描述不能超过1000个字符'
  }),
  price: Joi.number().min(0).precision(2).required().messages({
    'number.min': '价格必须大于等于0',
    'any.required': '价格不能为空'
  }),
  original_price: Joi.number().min(0).precision(2).allow(null).messages({
    'number.min': '原价必须大于等于0'
  }),
  image: Joi.string().uri().required().messages({
    'string.uri': '主图必须是有效的URL',
    'any.required': '主图不能为空'
  }),
  images: Joi.array().items(Joi.string().uri()).allow(null).messages({
    'array.base': '商品图片必须是数组',
    'string.uri': '图片URL必须是有效的URL'
  }),
  category_id: Joi.number().integer().positive().required().messages({
    'number.positive': '分类ID必须是正整数',
    'any.required': '分类不能为空'
  }),
  brand_id: Joi.number().integer().positive().allow(null).messages({
    'number.positive': '品牌ID必须是正整数'
  }),
  product_type_id: Joi.number().integer().positive().allow(null).messages({
    'number.positive': '商品类型ID必须是正整数'
  }),
  specifications: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
    )
  ).allow(null).messages({
    'object.base': '规格信息必须是对象格式'
  }),
  sku: Joi.string().max(100).allow('').messages({
    'string.max': 'SKU不能超过100个字符'
  }),
  stock: Joi.number().integer().min(0).default(0).messages({
    'number.min': '库存不能为负数'
  }),
  heat_score: Joi.number().integer().min(0).default(0).messages({
    'number.min': '热度分数不能为负数'
  }),
  is_ai_recommended: Joi.boolean().default(false).messages({
    'boolean.base': 'AI推荐状态必须是布尔值'
  }),
  ai_recommendation: Joi.string().allow('').max(500).messages({
    'string.max': 'AI推荐理由不能超过500个字符'
  }),
  source_platform: Joi.string().valid('bilibili', 'douyin', 'xiaohongshu').allow('').messages({
    'any.only': '来源平台必须是bilibili、douyin或xiaohongshu'
  }),
  source_url: Joi.string().uri().allow('').messages({
    'string.uri': '来源链接必须是有效的URL'
  }),
  tags: Joi.array().items(Joi.string()).allow(null).messages({
    'array.base': '标签必须是数组'
  }),
  status: Joi.number().integer().valid(0, 1).default(1).messages({
    'any.only': '状态必须是0或1'
  }),
  // 允许从AI推荐带入候选ID（仅用于后端联动，不影响商品字段校验）
  ai_candidate_id: Joi.number().integer().positive().allow(null)
});

// 分类验证规则
const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': '分类名称不能为空',
    'string.min': '分类名称至少1个字符',
    'string.max': '分类名称不能超过100个字符'
  }),
  parent_id: Joi.number().integer().min(0).default(0).messages({
    'number.min': '父分类ID不能为负数'
  }),
  level: Joi.number().integer().min(1).max(3).default(1).messages({
    'number.min': '分类层级至少为1',
    'number.max': '分类层级不能超过3'
  }),
  sort_order: Joi.number().integer().min(0).default(0).messages({
    'number.min': '排序不能为负数'
  }),
  icon: Joi.string().uri().allow('').messages({
    'string.uri': '图标必须是有效的URL'
  }),
  description: Joi.string().allow('').max(500).messages({
    'string.max': '分类描述不能超过500个字符'
  }),
  status: Joi.number().integer().valid(0, 1).default(1).messages({
    'any.only': '状态必须是0或1'
  })
});

// 品牌验证规则
const brandSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': '品牌名称不能为空',
    'string.min': '品牌名称至少1个字符',
    'string.max': '品牌名称不能超过100个字符'
  }),
  logo: Joi.string().uri().allow('').messages({
    'string.uri': '品牌logo必须是有效的URL'
  }),
  description: Joi.string().allow('').max(500).messages({
    'string.max': '品牌描述不能超过500个字符'
  }),
  website: Joi.string().uri().allow('').messages({
    'string.uri': '官网必须是有效的URL'
  }),
  status: Joi.number().integer().valid(0, 1).default(1).messages({
    'any.only': '状态必须是0或1'
  })
});

// 验证中间件
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors
      });
    }
    
    req.body = value;
    next();
  };
};

module.exports = {
  validate,
  validateProduct: validate(productSchema),
  validateCategory: validate(categorySchema),
  validateBrand: validate(brandSchema)
};

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const { validateProduct } = require('../middleware/validation');

// 获取商品列表
router.get('/', async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      search: req.query.search || '',
      category_id: req.query.category_id ? parseInt(req.query.category_id) : null,
      brand_id: req.query.brand_id ? parseInt(req.query.brand_id) : null,
      status: req.query.status !== undefined ? parseInt(req.query.status) : null,
      is_ai_recommended: req.query.is_ai_recommended !== undefined ? parseInt(req.query.is_ai_recommended) : null,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'DESC'
    };

    const result = await Product.getProducts(options);
    
    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品列表失败',
      error: error.message
    });
  }
});

// 获取商品详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的商品ID'
      });
    }

    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('获取商品详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取商品详情失败',
      error: error.message
    });
  }
});

// 创建商品
router.post('/', validateProduct, async (req, res) => {
  try {
    const productId = await Product.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '商品创建成功',
      data: { id: productId }
    });
  } catch (error) {
    console.error('创建商品失败:', error);
    res.status(500).json({
      success: false,
      message: '创建商品失败',
      error: error.message
    });
  }
});

// 更新商品
router.put('/:id', validateProduct, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的商品ID'
      });
    }

    // 检查商品是否存在
    const existingProduct = await Product.getById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    const updated = await Product.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: '更新商品失败'
      });
    }

    res.json({
      success: true,
      message: '商品更新成功'
    });
  } catch (error) {
    console.error('更新商品失败:', error);
    res.status(500).json({
      success: false,
      message: '更新商品失败',
      error: error.message
    });
  }
});

// 删除商品
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的商品ID'
      });
    }

    const deleted = await Product.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '商品不存在或删除失败'
      });
    }

    res.json({
      success: true,
      message: '商品删除成功'
    });
  } catch (error) {
    console.error('删除商品失败:', error);
    res.status(500).json({
      success: false,
      message: '删除商品失败',
      error: error.message
    });
  }
});

// 批量删除商品
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的商品ID列表'
      });
    }

    const deletedCount = await Product.batchDelete(ids);
    
    res.json({
      success: true,
      message: `成功删除 ${deletedCount} 个商品`
    });
  } catch (error) {
    console.error('批量删除商品失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除商品失败',
      error: error.message
    });
  }
});

// 更新商品状态
router.patch('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的商品ID'
      });
    }

    if (status !== 0 && status !== 1) {
      return res.status(400).json({
        success: false,
        message: '状态值必须是0或1'
      });
    }

    const updated = await Product.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '商品不存在或更新失败'
      });
    }

    res.json({
      success: true,
      message: '商品状态更新成功'
    });
  } catch (error) {
    console.error('更新商品状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新商品状态失败',
      error: error.message
    });
  }
});

// 更新商品库存
router.patch('/:id/stock', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { stock } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的商品ID'
      });
    }

    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({
        success: false,
        message: '库存必须是非负数'
      });
    }

    const updated = await Product.updateStock(id, stock);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '商品不存在或更新失败'
      });
    }

    res.json({
      success: true,
      message: '商品库存更新成功'
    });
  } catch (error) {
    console.error('更新商品库存失败:', error);
    res.status(500).json({
      success: false,
      message: '更新商品库存失败',
      error: error.message
    });
  }
});

// 获取AI推荐商品
router.get('/ai/recommended', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.getAIRecommended(limit);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('获取AI推荐商品失败:', error);
    res.status(500).json({
      success: false,
      message: '获取AI推荐商品失败',
      error: error.message
    });
  }
});

// 获取热门商品
router.get('/hot', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.getHotProducts(limit);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('获取热门商品失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热门商品失败',
      error: error.message
    });
  }
});

module.exports = router;

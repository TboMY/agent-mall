const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');
const { validateBrand } = require('../middleware/validation');

// 获取所有品牌
router.get('/', async (req, res) => {
  try {
    const brands = await Brand.getAll();
    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品牌列表失败',
      error: error.message
    });
  }
});

// 获取品牌详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的品牌ID'
      });
    }

    const brand = await Brand.getById(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: '品牌不存在'
      });
    }

    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
    console.error('获取品牌详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品牌详情失败',
      error: error.message
    });
  }
});

// 创建品牌
router.post('/', validateBrand, async (req, res) => {
  try {
    const brandId = await Brand.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '品牌创建成功',
      data: { id: brandId }
    });
  } catch (error) {
    console.error('创建品牌失败:', error);
    res.status(500).json({
      success: false,
      message: '创建品牌失败',
      error: error.message
    });
  }
});

// 更新品牌
router.put('/:id', validateBrand, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的品牌ID'
      });
    }

    // 检查品牌是否存在
    const existingBrand = await Brand.getById(id);
    if (!existingBrand) {
      return res.status(404).json({
        success: false,
        message: '品牌不存在'
      });
    }

    const updated = await Brand.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: '更新品牌失败'
      });
    }

    res.json({
      success: true,
      message: '品牌更新成功'
    });
  } catch (error) {
    console.error('更新品牌失败:', error);
    res.status(500).json({
      success: false,
      message: '更新品牌失败',
      error: error.message
    });
  }
});

// 删除品牌
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的品牌ID'
      });
    }

    const deleted = await Brand.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '品牌不存在或删除失败'
      });
    }

    res.json({
      success: true,
      message: '品牌删除成功'
    });
  } catch (error) {
    console.error('删除品牌失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除品牌失败'
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { validateCategory } = require('../middleware/validation');

// 获取所有分类
router.get('/', async (req, res) => {
  try {
    const categories = await Category.getAll();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类列表失败',
      error: error.message
    });
  }
});

// 获取分类树形结构
router.get('/tree', async (req, res) => {
  try {
    const tree = await Category.getTree();
    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('获取分类树失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类树失败',
      error: error.message
    });
  }
});

// 获取分类详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的分类ID'
      });
    }

    const category = await Category.getById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('获取分类详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类详情失败',
      error: error.message
    });
  }
});

// 创建分类
router.post('/', validateCategory, async (req, res) => {
  try {
    const categoryId = await Category.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '分类创建成功',
      data: { id: categoryId }
    });
  } catch (error) {
    console.error('创建分类失败:', error);
    res.status(500).json({
      success: false,
      message: '创建分类失败',
      error: error.message
    });
  }
});

// 更新分类
router.put('/:id', validateCategory, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的分类ID'
      });
    }

    // 检查分类是否存在
    const existingCategory = await Category.getById(id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    const updated = await Category.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: '更新分类失败'
      });
    }

    res.json({
      success: true,
      message: '分类更新成功'
    });
  } catch (error) {
    console.error('更新分类失败:', error);
    res.status(500).json({
      success: false,
      message: '更新分类失败',
      error: error.message
    });
  }
});

// 删除分类
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的分类ID'
      });
    }

    const deleted = await Category.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '分类不存在或删除失败'
      });
    }

    res.json({
      success: true,
      message: '分类删除成功'
    });
  } catch (error) {
    console.error('删除分类失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除分类失败'
    });
  }
});

module.exports = router;

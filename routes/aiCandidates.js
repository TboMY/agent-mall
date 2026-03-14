const express = require('express');
const router = express.Router();
const AIProductCandidate = require('../models/AIProductCandidate');
const Product = require('../models/Product');

// 获取AI推荐候选商品列表
router.get('/', async (req, res) => {
  try {
    // 兼容空字符串或非法数值的状态筛选
    const statusRaw = req.query.status;
    const parsedStatus = statusRaw === undefined || statusRaw === '' ? null : parseInt(statusRaw);

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search || '',
      status: Number.isNaN(parsedStatus) ? null : parsedStatus,
      product_name: req.query.product_name || null,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'DESC',
      start_time: req.query.start_time || null,
      end_time: req.query.end_time || null
    };

    const result = await AIProductCandidate.getCandidates(options);
    
    res.json({
      success: true,
      data: result.candidates,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取AI推荐候选商品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取AI推荐候选商品列表失败',
      error: error.message
    });
  }
});

// 获取候选商品详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的候选商品ID'
      });
    }

    const candidate = await AIProductCandidate.getById(id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: '候选商品不存在'
      });
    }

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    console.error('获取候选商品详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取候选商品详情失败',
      error: error.message
    });
  }
});

// 更新候选商品状态
router.patch('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的候选商品ID'
      });
    }

    if (![0, 1, 2].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '状态值必须是0(待审核)、1(已上架)或2(已拒绝)'
      });
    }

    const updated = await AIProductCandidate.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '候选商品不存在或更新失败'
      });
    }

    res.json({
      success: true,
      message: '候选商品状态更新成功'
    });
  } catch (error) {
    console.error('更新候选商品状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新候选商品状态失败',
      error: error.message
    });
  }
});

// 批量更新候选商品状态
router.patch('/batch/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的候选商品ID列表'
      });
    }

    if (![0, 1, 2].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '状态值必须是0(待审核)、1(已上架)或2(已拒绝)'
      });
    }

    const updatedCount = await AIProductCandidate.batchUpdateStatus(ids, status);
    
    res.json({
      success: true,
      message: `成功更新 ${updatedCount} 个候选商品状态`
    });
  } catch (error) {
    console.error('批量更新候选商品状态失败:', error);
    res.status(500).json({
      success: false,
      message: '批量更新候选商品状态失败',
      error: error.message
    });
  }
});

// 将候选商品转换为正式商品
router.post('/:id/convert', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const productData = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的候选商品ID'
      });
    }

    // 验证必要字段
    if (!productData.category_id) {
      return res.status(400).json({
        success: false,
        message: '请选择商品分类'
      });
    }

    if (!productData.price) {
      return res.status(400).json({
        success: false,
        message: '请输入商品价格'
      });
    }

    const productId = await AIProductCandidate.convertToProduct(id, productData);
    
    res.json({
      success: true,
      message: '候选商品已成功转换为正式商品',
      data: { productId }
    });
  } catch (error) {
    console.error('转换候选商品失败:', error);
    res.status(500).json({
      success: false,
      message: '转换候选商品失败',
      error: error.message
    });
  }
});

// 获取统计信息
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await AIProductCandidate.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message
    });
  }
});

// 删除候选商品
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的候选商品ID'
      });
    }

    const deleted = await AIProductCandidate.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '候选商品不存在或删除失败'
      });
    }

    res.json({
      success: true,
      message: '候选商品删除成功'
    });
  } catch (error) {
    console.error('删除候选商品失败:', error);
    res.status(500).json({
      success: false,
      message: '删除候选商品失败',
      error: error.message
    });
  }
});

module.exports = router;

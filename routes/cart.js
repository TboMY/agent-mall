const express = require('express');
const router = express.Router();

const ShoppingCart = require('../models/ShoppingCart');
const { authenticateCustomer } = require('../middleware/customerAuth');

router.use(authenticateCustomer);

// 获取当前用户购物车
router.get('/', async (req, res) => {
  try {
    const items = await ShoppingCart.getItemsByUserId(req.customerAuth.user.id);
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('获取购物车失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取购物车失败'
    });
  }
});

// 添加 SKU 到购物车
router.post('/items', async (req, res) => {
  try {
    const skuId = Number(req.body.sku_id);
    const quantity = Number(req.body.quantity || 1);
    if (!skuId || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'sku_id 和 quantity 必须有效'
      });
    }

    const items = await ShoppingCart.addItem(req.customerAuth.user.id, {
      sku_id: skuId,
      quantity,
      selected: req.body.selected
    });

    res.status(201).json({
      success: true,
      message: '已加入购物车',
      data: items
    });
  } catch (error) {
    console.error('加入购物车失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '加入购物车失败'
    });
  }
});

// 更新购物车项
router.patch('/items/:id', async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: '无效的购物车项 ID'
      });
    }

    const items = await ShoppingCart.updateItem(req.customerAuth.user.id, itemId, {
      quantity: req.body.quantity,
      selected: req.body.selected
    });

    res.json({
      success: true,
      message: '购物车更新成功',
      data: items
    });
  } catch (error) {
    console.error('更新购物车失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新购物车失败'
    });
  }
});

// 删除单个购物车项
router.delete('/items/:id', async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: '无效的购物车项 ID'
      });
    }

    const items = await ShoppingCart.removeItems(req.customerAuth.user.id, [itemId]);
    res.json({
      success: true,
      message: '购物车项删除成功',
      data: items
    });
  } catch (error) {
    console.error('删除购物车项失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '删除购物车项失败'
    });
  }
});

// 批量删除购物车项
router.delete('/items', async (req, res) => {
  try {
    const itemIds = Array.isArray(req.body.item_ids) ? req.body.item_ids : [];
    const items = await ShoppingCart.removeItems(req.customerAuth.user.id, itemIds);
    res.json({
      success: true,
      message: '购物车已更新',
      data: items
    });
  } catch (error) {
    console.error('批量删除购物车项失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '批量删除购物车项失败'
    });
  }
});

module.exports = router;

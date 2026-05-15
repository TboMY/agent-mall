const express = require('express');

const Order = require('../models/Order');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(requirePermission(PERMISSIONS.ORDERS_VIEW));

/**
 * 后台订单列表。
 */
router.get('/', async (req, res) => {
  try {
    const result = await Order.list({
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      search: req.query.search || '',
      status: req.query.status || '',
      payment_status: req.query.payment_status || ''
    });

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
});

/**
 * 后台订单详情。
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的订单ID' });
    }

    const order = await Order.getById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单详情失败',
      error: error.message
    });
  }
});

/**
 * 后台更新订单流转状态，仅开放发货、完成、取消三个动作。
 */
router.patch('/:id/status', requirePermission(PERMISSIONS.ORDERS_MANAGE), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const action = String(req.body.action || '').trim();

    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的订单ID'
      });
    }

    const order = await Order.getById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    let success = false;
    let message = '';

    if (action === 'ship') {
      success = await Order.markShipped(id);
      message = success ? '订单已发货' : '当前订单状态不允许发货';
    } else if (action === 'complete') {
      success = await Order.markCompleted(id);
      message = success ? '订单已完成' : '当前订单状态不允许完成';
    } else if (action === 'cancel') {
      success = await Order.markCancelled(id);
      message = success ? '订单已取消' : '当前订单状态不允许取消';
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的订单操作'
      });
    }

    if (!success) {
      return res.status(400).json({
        success: false,
        message
      });
    }

    const latestOrder = await Order.getById(id);
    res.json({
      success: true,
      message,
      data: latestOrder
    });
  } catch (error) {
    console.error('更新订单状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新订单状态失败',
      error: error.message
    });
  }
});

module.exports = router;

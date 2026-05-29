const express = require('express');
const router = express.Router();

const Order = require('../models/Order');
const CustomerOrderService = require('../services/CustomerOrderService');
const ReturnRequestService = require('../services/ReturnRequestService');
const { authenticateCustomer } = require('../middleware/customerAuth');

router.use(authenticateCustomer);

// 当前用户订单列表
router.get('/', async (req, res) => {
  try {
    const result = await Order.listByUser(req.customerAuth.user.id, {
      page: req.query.page,
      limit: req.query.limit
    });

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取前台订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订单列表失败'
    });
  }
});

router.get('/by-order-no/:orderNo', async (req, res) => {
  try {
    const order = await Order.getByOrderNoForUser(req.params.orderNo, req.customerAuth.user.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('根据订单号获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订单详情失败'
    });
  }
});

router.post('/by-order-no/:orderNo/reconcile-payment', async (req, res) => {
  try {
    console.log('[alipay] reconcile route hit', {
      userId: req.customerAuth.user.id,
      orderNo: req.params.orderNo
    });
    const order = await Order.getByOrderNoForUser(req.params.orderNo, req.customerAuth.user.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    const result = await CustomerOrderService.reconcileAlipayPayment(req.customerAuth.user.id, req.params.orderNo);
    res.json({
      success: true,
      message: result.reconciled ? '支付结果已同步' : '支付结果暂未更新',
      data: result.order
    });
  } catch (error) {
    console.error('主动同步支付结果失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '主动同步支付结果失败'
    });
  }
});

// 当前用户订单详情
router.get('/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '无效的订单 ID'
      });
    }

    const order = await Order.getByIdForUser(orderId, req.customerAuth.user.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('获取前台订单详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取订单详情失败'
    });
  }
});

// 从购物车结算下单
router.post('/checkout', async (req, res) => {
  try {
    const result = await CustomerOrderService.createFromCart(req.customerAuth.user.id, {
      item_ids: req.body.item_ids,
      address_id: req.body.address_id,
      remark: req.body.remark
    });
    const order = await Order.getByIdForUser(result.orderId, req.customerAuth.user.id);

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      data: order
    });
  } catch (error) {
    console.error('购物车结算失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '购物车结算失败'
    });
  }
});

// 直接购买单个 SKU
router.post('/direct', async (req, res) => {
  try {
    const result = await CustomerOrderService.createDirect(req.customerAuth.user.id, {
      sku_id: req.body.sku_id,
      quantity: req.body.quantity,
      address_id: req.body.address_id,
      remark: req.body.remark
    });
    const order = await Order.getByIdForUser(result.orderId, req.customerAuth.user.id);

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      data: order
    });
  } catch (error) {
    console.error('直接购买失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '直接购买失败'
    });
  }
});

// 发起支付宝网页支付
router.post('/:id/pay-alipay', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    console.log('[alipay] pay route hit', {
      userId: req.customerAuth.user.id,
      orderId
    });
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '无效的订单 ID'
      });
    }

    const payment = await CustomerOrderService.createAlipayPagePayment(req.customerAuth.user.id, orderId);
    res.json({
      success: true,
      message: '已生成支付宝支付链接',
      data: payment
    });
  } catch (error) {
    console.error('[alipay] pay route failed:', error);
    res.status(400).json({
      success: false,
      message: error.message || '发起支付宝支付失败'
    });
  }
});

// 当前用户取消未付款订单
router.post('/:id/cancel', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '无效的订单 ID'
      });
    }

    const order = await Order.getByIdForUser(orderId, req.customerAuth.user.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    const success = await Order.markCancelled(orderId);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: '当前订单状态不允许取消'
      });
    }

    const latestOrder = await Order.getByIdForUser(orderId, req.customerAuth.user.id);
    res.json({
      success: true,
      message: '订单已取消',
      data: latestOrder
    });
  } catch (error) {
    console.error('前台取消订单失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '取消订单失败'
    });
  }
});

// 当前用户确认收货
router.post('/:id/confirm-receipt', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '无效的订单 ID'
      });
    }

    const order = await Order.getByIdForUser(orderId, req.customerAuth.user.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    const success = await Order.markCompleted(orderId);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: '当前订单状态不允许确认收货'
      });
    }

    const latestOrder = await Order.getByIdForUser(orderId, req.customerAuth.user.id);
    res.json({
      success: true,
      message: '确认收货成功',
      data: latestOrder
    });
  } catch (error) {
    console.error('确认收货失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '确认收货失败'
    });
  }
});

// 当前用户申请退货/退款
router.post('/:id/return-request', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '无效的订单 ID'
      });
    }

    await ReturnRequestService.create(req.customerAuth.user.id, orderId, {
      reason: req.body.reason,
      description: req.body.description
    });

    const order = await Order.getByIdForUser(orderId, req.customerAuth.user.id);
    res.status(201).json({
      success: true,
      message: '退货申请已提交',
      data: order
    });
  } catch (error) {
    console.error('提交退货申请失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '提交退货申请失败'
    });
  }
});

module.exports = router;

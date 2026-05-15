const express = require('express');
const OrderPaymentService = require('../services/OrderPaymentService');

const router = express.Router();

router.post('/alipay/notify', async (req, res) => {
  try {
    await OrderPaymentService.handleNotify(req.body);
    res.send('success');
  } catch (error) {
    console.error('支付宝回调处理失败:', error);
    res.status(400).send('fail');
  }
});

module.exports = router;

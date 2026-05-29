const express = require('express');
const OrderPaymentService = require('../services/OrderPaymentService');

const router = express.Router();

router.post('/alipay/notify', async (req, res) => {
  try {
    console.log('[alipay] notify route hit', {
      orderNo: req.body?.out_trade_no || null,
      tradeNo: req.body?.trade_no || null,
      tradeStatus: req.body?.trade_status || null
    });
    await OrderPaymentService.handleNotify(req.body);
    res.send('success');
  } catch (error) {
    console.error('[alipay] notify route failed:', error);
    res.status(400).send('fail');
  }
});

module.exports = router;

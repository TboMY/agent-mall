const { transaction } = require('../config/database');
const Order = require('../models/Order');
const AlipaySandboxService = require('./AlipaySandboxService');

class OrderPaymentService {
  static async reconcileOrderPayment(order) {
    console.log('[alipay] reconcile order start', {
      orderId: order?.id || null,
      orderNo: order?.order_no || null,
      paymentStatus: order?.payment_status || null,
      status: order?.status || null
    });
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.payment_status === 'paid') {
      return { reconciled: false, order };
    }

    const response = await AlipaySandboxService.execute('alipay.trade.query', {
      out_trade_no: order.order_no
    });

    console.log('[alipay] reconcile order query result', {
      orderId: order.id,
      orderNo: order.order_no,
      code: response?.code || null,
      msg: response?.msg || null,
      subCode: response?.sub_code || null,
      subMsg: response?.sub_msg || null,
      tradeStatus: response?.trade_status || null,
      totalAmount: response?.total_amount || null
    });

    if (!response || response.code !== '10000') {
      throw new Error(response?.sub_msg || response?.msg || '支付宝查单失败');
    }

    const tradeStatus = response.trade_status;
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
      return { reconciled: false, order };
    }

    const totalAmount = Number(response.total_amount || 0);
    if (Number(order.payable_amount).toFixed(2) !== totalAmount.toFixed(2)) {
      throw new Error('支付宝查单金额校验失败');
    }

    await transaction(async (connection) => {
      await Order.markPaidByGateway(connection, order.id, {
        trade_no: response.trade_no,
        buyer_logon_id: response.buyer_logon_id,
        trade_status: tradeStatus,
        raw_notify_payload: response
      });
    });

    const latestOrder = await Order.getByOrderNo(order.order_no);
    console.log('[alipay] reconcile order paid', {
      orderId: latestOrder?.id || order.id,
      orderNo: order.order_no,
      paymentStatus: latestOrder?.payment_status || null,
      status: latestOrder?.status || null
    });
    return { reconciled: true, order: latestOrder };
  }

  static async handleNotify(payload) {
    console.log('[alipay] notify received', {
      orderNo: payload?.out_trade_no || null,
      tradeNo: payload?.trade_no || null,
      tradeStatus: payload?.trade_status || null,
      totalAmount: payload?.total_amount || null
    });
    if (!AlipaySandboxService.verifyParams(payload)) {
      console.warn('[alipay] notify verify failed', {
        orderNo: payload?.out_trade_no || null,
        tradeNo: payload?.trade_no || null
      });
      throw new Error('支付宝回调验签失败');
    }

    const orderNo = payload.out_trade_no;
    const tradeStatus = payload.trade_status;
    const totalAmount = Number(payload.total_amount || 0);

    if (!orderNo) {
      throw new Error('缺少商户订单号');
    }

    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
      console.log('[alipay] notify ignored by trade status', { orderNo, tradeStatus });
      return { ignored: true };
    }

    await transaction(async (connection) => {
      const order = await Order.getByOrderNo(orderNo);
      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.payment_status === 'paid') {
        console.log('[alipay] notify skipped because already paid', {
          orderId: order.id,
          orderNo
        });
        return;
      }

      if (Number(order.payable_amount).toFixed(2) !== totalAmount.toFixed(2)) {
        throw new Error('订单金额校验失败');
      }

      await Order.markPaidByGateway(connection, order.id, {
        trade_no: payload.trade_no,
        buyer_logon_id: payload.buyer_logon_id,
        trade_status: tradeStatus,
        raw_notify_payload: payload
      });
    });

    console.log('[alipay] notify handled', { orderNo, tradeStatus });
    return { success: true };
  }

  static async refundOrder(order, reason = '退货退款') {
    console.log('[alipay] refund start', {
      orderId: order?.id || null,
      orderNo: order?.order_no || null,
      amount: order?.payable_amount || null,
      reason
    });
    const response = await AlipaySandboxService.execute('alipay.trade.refund', {
      out_trade_no: order.order_no,
      refund_amount: Number(order.payable_amount).toFixed(2),
      refund_reason: reason
    });

    console.log('[alipay] refund result', {
      orderId: order.id,
      orderNo: order.order_no,
      code: response?.code || null,
      msg: response?.msg || null,
      subCode: response?.sub_code || null,
      subMsg: response?.sub_msg || null,
      refundFee: response?.refund_fee || null
    });

    if (!response || response.code !== '10000') {
      throw new Error(response?.sub_msg || response?.msg || '支付宝退款失败');
    }

    return response;
  }
}

module.exports = OrderPaymentService;

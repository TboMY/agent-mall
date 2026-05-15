const { transaction } = require('../config/database');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ProductSku = require('../models/ProductSku');
const ReturnRequest = require('../models/ReturnRequest');
const OrderPaymentService = require('./OrderPaymentService');

class ReturnRequestService {
  /**
   * 前台用户提交退货/退款申请。
   */
  static async create(userId, orderId, payload) {
    return await transaction(async (connection) => {
      const order = await Order.getByIdForUser(orderId, userId);
      if (!order) {
        throw new Error('订单不存在');
      }

      if (!['shipped', 'completed'].includes(order.status) || order.payment_status !== 'paid') {
        throw new Error('当前订单状态不允许申请退货');
      }

      const latestRequest = await ReturnRequest.getLatestByOrderId(orderId, connection);
      if (latestRequest && ['pending', 'approved'].includes(latestRequest.status)) {
        throw new Error('该订单已有处理中的退货申请');
      }

      const reason = String(payload.reason || '').trim();
      const description = String(payload.description || '').trim();
      if (!reason) {
        throw new Error('请选择或填写退货原因');
      }

      const [result] = await connection.query(
        `INSERT INTO return_requests (
          order_id, user_id, order_no, order_status_before, reason, description,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          order.id,
          userId,
          order.order_no,
          order.status,
          reason,
          description || null
        ]
      );

      await connection.query(
        `UPDATE orders
         SET status = 'refunding', updated_at = NOW()
         WHERE id = ?`,
        [order.id]
      );

      return result.insertId;
    });
  }

  /**
   * 后台同意退款：回退库存、退回余额、订单改为已退款。
   */
  static async approve(requestId, adminRemark = '') {
    return await transaction(async (connection) => {
      const [requests] = await connection.query(
        `SELECT *
         FROM return_requests
         WHERE id = ?
         LIMIT 1`,
        [requestId]
      );
      const request = requests[0];
      if (!request) {
        throw new Error('退货申请不存在');
      }
      if (request.status !== 'pending') {
        throw new Error('当前申请已处理，请勿重复操作');
      }

      const [orders] = await connection.query(
        `SELECT *
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [request.order_id]
      );
      const order = orders[0];
      if (!order) {
        throw new Error('关联订单不存在');
      }

      if (order.payment_status === 'paid') {
        await OrderPaymentService.refundOrder(order, request.reason || '退货退款');
      }

      const [items] = await connection.query(
        `SELECT *
         FROM order_items
         WHERE order_id = ?
         ORDER BY id ASC`,
        [order.id]
      );

      for (const item of items) {
        if (item.sku_id) {
          await ProductSku.increaseStock(connection, item.sku_id, Number(item.quantity || 0));
        }

        if (item.product_id) {
          const latestSkus = await ProductSku.getByProductId(item.product_id, connection);
          await Product.syncProductSummaryFromSkus(connection, item.product_id, latestSkus);
        }
      }

      await Order.markRefundedByGateway(connection, order.id, {
        trade_status: 'REFUND_SUCCESS',
        raw_notify_payload: {
          refund_reason: request.reason || null,
          request_id: request.id
        }
      });

      await connection.query(
        `UPDATE return_requests
         SET status = 'approved',
             admin_remark = ?,
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [adminRemark || null, requestId]
      );
    });
  }

  /**
   * 后台驳回退货申请：恢复订单原状态。
   */
  static async reject(requestId, adminRemark = '') {
    return await transaction(async (connection) => {
      const [requests] = await connection.query(
        `SELECT *
         FROM return_requests
         WHERE id = ?
         LIMIT 1`,
        [requestId]
      );
      const request = requests[0];
      if (!request) {
        throw new Error('退货申请不存在');
      }
      if (request.status !== 'pending') {
        throw new Error('当前申请已处理，请勿重复操作');
      }

      await connection.query(
        `UPDATE orders
         SET status = ?, updated_at = NOW()
         WHERE id = ?`,
        [request.order_status_before, request.order_id]
      );

      await connection.query(
        `UPDATE return_requests
         SET status = 'rejected',
             admin_remark = ?,
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [adminRemark || null, requestId]
      );
    });
  }
}

module.exports = ReturnRequestService;

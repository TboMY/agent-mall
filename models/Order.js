const { query } = require('../config/database');
const ReturnRequest = require('./ReturnRequest');

class Order {
  static parseJsonField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  static async attachItemsAndAfterSale(orders) {
    if (!orders.length) return orders;

    const orderIds = orders.map((order) => order.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const items = await query(
      `SELECT *
       FROM order_items
       WHERE order_id IN (${placeholders})
       ORDER BY order_id ASC, id ASC`,
      orderIds
    );

    const latestReturnRequests = await query(
      `SELECT rr.*
       FROM return_requests rr
       INNER JOIN (
         SELECT order_id, MAX(id) AS latest_id
         FROM return_requests
         WHERE order_id IN (${placeholders})
         GROUP BY order_id
       ) latest ON latest.latest_id = rr.id`,
      orderIds
    );

    const itemMap = new Map();
    const returnRequestMap = new Map();

    for (const item of items) {
      const normalized = {
        ...item,
        spec_summary: this.parseJsonField(item.spec_summary)
      };
      if (!itemMap.has(item.order_id)) {
        itemMap.set(item.order_id, []);
      }
      itemMap.get(item.order_id).push(normalized);
    }

    for (const request of latestReturnRequests) {
      returnRequestMap.set(request.order_id, request);
    }

    return orders.map((order) => ({
      ...order,
      items: itemMap.get(order.id) || [],
      latest_return_request: returnRequestMap.get(order.id) || null
    }));
  }

  /**
   * 分页获取订单列表，支持订单号、状态和用户筛选。
   */
  static async list(options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (options.search) {
      conditions.push('(o.order_no LIKE ? OR u.username LIKE ? OR o.consignee_name LIKE ?)');
      const keyword = `%${options.search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (options.status) {
      conditions.push('o.status = ?');
      params.push(options.status);
    }

    if (options.payment_status) {
      conditions.push('o.payment_status = ?');
      params.push(options.payment_status);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const listSql = `
      SELECT
        o.*,
        u.username,
        u.nickname
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ${whereSql}
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `
      SELECT COUNT(*) AS total
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ${whereSql}
    `;

    const rows = await query(listSql, params);
    const [{ total }] = await query(countSql, params);

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取单个订单详情及其明细。
   */
  static async getById(id) {
    const orderSql = `
      SELECT
        o.*,
        u.username,
        u.nickname,
        u.phone AS user_phone,
        u.email AS user_email
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
      LIMIT 1
    `;
    const itemSql = 'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC';

    const [order] = await query(orderSql, [id]);
    if (!order) {
      return null;
    }

    order.items = (await query(itemSql, [id])).map((item) => ({
      ...item,
      spec_summary: this.parseJsonField(item.spec_summary)
    }));
    order.latest_return_request = await ReturnRequest.getLatestByOrderId(id);
    return order;
  }

  /**
   * 获取当前前台用户的订单列表。
   */
  static async listByUser(userId, options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const offset = (page - 1) * limit;

    const rows = await query(
      `SELECT *
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    );
    const [{ total }] = await query(
      'SELECT COUNT(*) AS total FROM orders WHERE user_id = ?',
      [userId]
    );

    return {
      items: await this.attachItemsAndAfterSale(rows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取当前前台用户的订单详情。
   */
  static async getByIdForUser(id, userId) {
    const order = await this.getById(id);
    if (!order || Number(order.user_id) !== Number(userId)) {
      return null;
    }
    return order;
  }

  static async getByOrderNo(orderNo) {
    const [row] = await query(
      `SELECT *
       FROM orders
       WHERE order_no = ?
       LIMIT 1`,
      [orderNo]
    );
    return row || null;
  }

  static async getByOrderNoForUser(orderNo, userId) {
    const order = await this.getByOrderNo(orderNo);
    if (!order || Number(order.user_id) !== Number(userId)) {
      return null;
    }
    return this.getById(order.id);
  }

  /**
   * 更新订单支付完成后的状态。
   */
  static async markPaid(connection, orderId) {
    await connection.query(
      `UPDATE orders
       SET payment_status = 'paid',
           status = 'paid',
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [orderId]
    );
  }

  /**
   * 后台发货，将已付款订单推进到待收货阶段。
   */
  static async markShipped(orderId) {
    const result = await query(
      `UPDATE orders
       SET status = 'shipped',
           shipped_at = NOW(),
           updated_at = NOW()
       WHERE id = ?
         AND status = 'paid'
         AND payment_status = 'paid'`,
      [orderId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 后台完成订单，将已发货订单标记为已完成。
   */
  static async markCompleted(orderId) {
    const result = await query(
      `UPDATE orders
       SET status = 'completed',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?
         AND status = 'shipped'
         AND payment_status = 'paid'`,
      [orderId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 后台取消未付款订单。
   */
  static async markCancelled(orderId) {
    const result = await query(
      `UPDATE orders
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = ?
         AND status = 'pending_payment'
         AND payment_status = 'unpaid'`,
      [orderId]
    );
    return result.affectedRows > 0;
  }

  static async markPaidByGateway(connection, orderId, payload = {}) {
    await connection.query(
      `UPDATE orders
       SET payment_status = 'paid',
           status = 'paid',
           paid_at = NOW(),
           trade_no = ?,
           buyer_logon_id = ?,
           trade_status = ?,
           payment_channel = 'alipay',
           raw_payment_notify = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        payload.trade_no || null,
        payload.buyer_logon_id || null,
        payload.trade_status || 'TRADE_SUCCESS',
        payload.raw_notify_payload ? JSON.stringify(payload.raw_notify_payload) : null,
        orderId
      ]
    );
  }

  static async markRefundedByGateway(connection, orderId, payload = {}) {
    await connection.query(
      `UPDATE orders
       SET status = 'refunded',
           payment_status = 'refunded',
           trade_status = ?,
           raw_payment_notify = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        payload.trade_status || 'REFUND_SUCCESS',
        payload.raw_notify_payload ? JSON.stringify(payload.raw_notify_payload) : null,
        orderId
      ]
    );
  }
}

module.exports = Order;

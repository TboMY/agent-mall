const { query } = require('../config/database');

class ReturnRequest {
  /**
   * 根据申请ID获取单条退货申请。
   */
  static async getById(id) {
    const [row] = await query(
      `SELECT
         rr.*,
         u.username,
         u.nickname
       FROM return_requests rr
       LEFT JOIN users u ON u.id = rr.user_id
       WHERE rr.id = ?
       LIMIT 1`,
      [id]
    );
    return row || null;
  }

  /**
   * 后台分页查看退货申请列表。
   */
  static async list(options = {}) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (options.search) {
      conditions.push('(rr.order_no LIKE ? OR u.username LIKE ? OR rr.reason LIKE ?)');
      const keyword = `%${options.search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (options.status) {
      conditions.push('rr.status = ?');
      params.push(options.status);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `SELECT
         rr.*,
         u.username,
         u.nickname,
         o.payable_amount,
         o.status AS order_status,
         o.payment_status
       FROM return_requests rr
       LEFT JOIN users u ON u.id = rr.user_id
       LEFT JOIN orders o ON o.id = rr.order_id
       ${whereSql}
       ORDER BY rr.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [{ total }] = await query(
      `SELECT COUNT(*) AS total
       FROM return_requests rr
       LEFT JOIN users u ON u.id = rr.user_id
       ${whereSql}`,
      params
    );

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
   * 根据订单查找是否已有处理中/已完成的退货申请。
   */
  static async getLatestByOrderId(orderId, connection = null) {
    if (connection) {
      const [rows] = await connection.query(
        `SELECT *
         FROM return_requests
         WHERE order_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [orderId]
      );
      return rows[0] || null;
    }

    const [row] = await query(
      `SELECT *
       FROM return_requests
       WHERE order_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [orderId]
    );
    return row || null;
  }
}

module.exports = ReturnRequest;

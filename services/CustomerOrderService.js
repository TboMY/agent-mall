const { transaction } = require('../config/database');
const Product = require('../models/Product');
const ProductSku = require('../models/ProductSku');
const ShoppingCart = require('../models/ShoppingCart');
const Order = require('../models/Order');
const AlipaySandboxService = require('./AlipaySandboxService');
const OrderPaymentService = require('./OrderPaymentService');

class CustomerOrderService {
  static buildOrderNo() {
    const now = new Date();
    const pad = (value, length = 2) => String(value).padStart(length, '0');
    const datePart = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join('');
    const timePart = [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join('');
    const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `AM${datePart}${timePart}${randomPart}`;
  }

  static async getAddress(connection, userId, addressId = null) {
    if (addressId) {
      const [rows] = await connection.query(
        'SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1',
        [addressId, userId]
      );
      return rows[0] || null;
    }

    const [rows] = await connection.query(
      `SELECT *
       FROM user_addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, id ASC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  static formatShippingAddress(address) {
    return [
      address.province,
      address.city,
      address.district,
      address.detail_address
    ].filter(Boolean).join(' ');
  }

  static async createFromCart(userId, payload) {
    return await transaction(async (connection) => {
      const address = await this.getAddress(connection, userId, payload.address_id);
      if (!address) {
        throw new Error('请先设置收货地址');
      }

      const items = await ShoppingCart.getCheckoutItems(connection, userId, payload.item_ids);
      if (!items.length) {
        throw new Error('未找到可结算的购物车项');
      }

      const totalAmount = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
      const orderNo = this.buildOrderNo();

      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          order_no, user_id, total_amount, payable_amount, status, payment_status,
          consignee_name, consignee_phone, shipping_address, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending_payment', 'unpaid', ?, ?, ?, ?, NOW(), NOW())`,
        [
          orderNo,
          userId,
          totalAmount,
          totalAmount,
          address.recipient_name,
          address.recipient_phone,
          this.formatShippingAddress(address),
          payload.remark || null
        ]
      );

      const orderId = orderResult.insertId;

      for (const item of items) {
        const success = await ProductSku.decreaseStock(connection, item.sku_id, item.quantity);
        if (!success) {
          throw new Error(`SKU ${item.sku_name} 库存不足`);
        }

        await connection.query(
          `INSERT INTO order_items (
            order_id, product_id, sku_id, sku_code, sku_name, spec_summary,
            product_name, product_image, unit_price, quantity, line_total,
            source_platform, source_url, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            orderId,
            item.product_id,
            item.sku_id,
            item.sku_code,
            item.sku_name,
            JSON.stringify(item.spec_summary || []),
            item.product_name,
            item.sku_image || item.product_image || null,
            item.price,
            item.quantity,
            Number(item.price) * Number(item.quantity),
            item.source_platform || null,
            item.source_url || null
          ]
        );

        await connection.query(
          'UPDATE products SET sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
          [item.quantity, item.product_id]
        );
        const latestSkus = await ProductSku.getByProductId(item.product_id, connection);
        await Product.syncProductSummaryFromSkus(connection, item.product_id, latestSkus);
      }

      const itemIds = items.map((item) => item.id);
      const placeholders = itemIds.map(() => '?').join(',');
      await connection.query(
        `DELETE FROM cart_items WHERE id IN (${placeholders})`,
        itemIds
      );

      return { orderId, orderNo };
    });
  }

  static async createDirect(userId, payload) {
    return await transaction(async (connection) => {
      const address = await this.getAddress(connection, userId, payload.address_id);
      if (!address) {
        throw new Error('请先设置收货地址');
      }

      const sku = await ProductSku.getById(payload.sku_id, connection);
      if (!sku || Number(sku.status) !== 1 || Number(sku.product_status) !== 1) {
        throw new Error('SKU 不存在或已下架');
      }

      const quantity = Math.max(1, Number(payload.quantity || 1));
      if (quantity > Number(sku.stock)) {
        throw new Error('库存不足');
      }

      const totalAmount = Number(sku.price) * quantity;
      const orderNo = this.buildOrderNo();

      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          order_no, user_id, total_amount, payable_amount, status, payment_status,
          consignee_name, consignee_phone, shipping_address, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending_payment', 'unpaid', ?, ?, ?, ?, NOW(), NOW())`,
        [
          orderNo,
          userId,
          totalAmount,
          totalAmount,
          address.recipient_name,
          address.recipient_phone,
          this.formatShippingAddress(address),
          payload.remark || null
        ]
      );

      const orderId = orderResult.insertId;
      const success = await ProductSku.decreaseStock(connection, sku.id, quantity);
      if (!success) {
        throw new Error('库存不足');
      }

      await connection.query(
        `INSERT INTO order_items (
          order_id, product_id, sku_id, sku_code, sku_name, spec_summary,
          product_name, product_image, unit_price, quantity, line_total,
          source_platform, source_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          orderId,
          sku.product_id,
          sku.id,
          sku.sku_code,
          sku.sku_name,
          JSON.stringify(sku.spec_summary || []),
          sku.product_name,
          sku.image || null,
          sku.price,
          quantity,
          totalAmount,
          null,
          null
        ]
      );

      await connection.query(
        'UPDATE products SET sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
        [quantity, sku.product_id]
      );
      const latestSkus = await ProductSku.getByProductId(sku.product_id, connection);
      await Product.syncProductSummaryFromSkus(connection, sku.product_id, latestSkus);

      return { orderId, orderNo };
    });
  }

  static async createAlipayPagePayment(userId, orderId) {
    const order = await Order.getByIdForUser(orderId, userId);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.payment_status === 'paid') {
      throw new Error('订单已支付，请勿重复付款');
    }

    if (order.status !== 'pending_payment' || order.payment_status !== 'unpaid') {
      throw new Error('当前订单状态不允许支付');
    }

    const subject = order.items?.[0]?.product_name
      ? `${order.items[0].product_name}${order.items.length > 1 ? '等商品' : ''}`
      : `订单支付 ${order.order_no}`;

    return {
      order_id: order.id,
      order_no: order.order_no,
      payment_url: AlipaySandboxService.buildPagePayUrl({
        order_no: order.order_no,
        amount: order.payable_amount,
        subject,
        body: `订单 ${order.order_no} 支付`,
        return_url: AlipaySandboxService.getConfig().orderReturnUrl
      })
    };
  }

  static async reconcileAlipayPayment(userId, orderNo) {
    const order = await Order.getByOrderNoForUser(orderNo, userId);
    if (!order) {
      throw new Error('订单不存在');
    }

    const result = await OrderPaymentService.reconcileOrderPayment(order);
    if (!result.order) {
      return result;
    }

    return {
      ...result,
      order: await Order.getByIdForUser(result.order.id, userId)
    };
  }
}

module.exports = CustomerOrderService;

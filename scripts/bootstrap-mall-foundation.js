require('dotenv').config();

const bcrypt = require('bcryptjs');
const { mallPool, closePools } = require('../config/database');
const { DEFAULT_ROLE_DEFINITIONS } = require('../config/permissions');

async function executeStatements(connection, statements) {
  for (const statement of statements) {
    const sql = statement.trim();
    if (!sql) {
      continue;
    }
    await connection.query(sql);
  }
}

async function seedDefaultSkusForProducts(connection) {
  const [products] = await connection.query(`
    SELECT id, name, price, original_price, stock, image, sku, status
    FROM products
    ORDER BY id ASC
  `);

  for (const product of products) {
    const [rows] = await connection.query(
      'SELECT COUNT(*) AS count FROM product_skus WHERE product_id = ?',
      [product.id]
    );

    if (Number(rows[0]?.count || 0) === 0) {
      await connection.query(
        `INSERT INTO product_skus (
          product_id, sku_code, sku_name, price, original_price, stock, image,
          status, is_default, sort_order, spec_summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 10, JSON_ARRAY(), NOW(), NOW())`,
        [
          product.id,
          product.sku || `PRD${product.id}-DEFAULT`,
          `${product.name} 默认款`,
          product.price,
          product.original_price,
          product.stock || 0,
          product.image || null,
          product.status
        ]
      );
    }

    const [skuRows] = await connection.query(
      `SELECT sku_code, price, original_price, stock, status, is_default
       FROM product_skus
       WHERE product_id = ?
       ORDER BY is_default DESC, sort_order ASC, id ASC`,
      [product.id]
    );

    if (!skuRows.length) {
      continue;
    }

    const activeSkus = skuRows.filter((sku) => Number(sku.status) === 1);
    const candidates = activeSkus.length ? activeSkus : skuRows;
    const defaultSku = candidates.find((sku) => Number(sku.is_default) === 1) || candidates[0];
    const price = Math.min(...candidates.map((sku) => Number(sku.price || 0)));
    const originalPrices = candidates
      .map((sku) => (sku.original_price == null ? null : Number(sku.original_price)))
      .filter((value) => value != null);
    const stock = candidates.reduce((sum, sku) => sum + Number(sku.stock || 0), 0);

    await connection.query(
      `UPDATE products
       SET sku = ?, price = ?, original_price = ?, stock = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        defaultSku?.sku_code || '',
        price,
        originalPrices.length ? Math.min(...originalPrices) : null,
        stock,
        product.id
      ]
    );
  }
}

async function main() {
  const connection = await mallPool.getConnection();
  try {
    console.log('[bootstrap] start');
    await connection.beginTransaction();

    const ddlStatements = [
      `CREATE TABLE IF NOT EXISTS admin_roles (
        id INT NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(50) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        status TINYINT NOT NULL DEFAULT 1,
        is_system TINYINT NOT NULL DEFAULT 0,
        permissions JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_admin_roles_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台角色表'`,

      `ALTER TABLE admin_users
        MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT '角色编码'`,

      `ALTER TABLE product_types
        ADD COLUMN IF NOT EXISTS category_id INT NULL COMMENT '所属分类ID' AFTER id`,

      `CREATE TABLE IF NOT EXISTS product_skus (
        id BIGINT NOT NULL AUTO_INCREMENT,
        product_id INT NOT NULL,
        sku_code VARCHAR(100) NOT NULL,
        sku_name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        original_price DECIMAL(10, 2) DEFAULT NULL,
        stock INT NOT NULL DEFAULT 0,
        image VARCHAR(500) DEFAULT NULL,
        status TINYINT NOT NULL DEFAULT 1,
        is_default TINYINT NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        spec_summary JSON DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_product_skus_code (sku_code),
        KEY idx_product_skus_product (product_id),
        KEY idx_product_skus_status (status),
        CONSTRAINT fk_product_skus_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品SKU表'`,

      `CREATE TABLE IF NOT EXISTS product_sku_specs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        sku_id BIGINT NOT NULL,
        attribute_id INT NOT NULL,
        attribute_value_id INT DEFAULT NULL,
        custom_value VARCHAR(255) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_product_sku_specs_sku_attr (sku_id, attribute_id),
        KEY idx_product_sku_specs_attr (attribute_id),
        KEY idx_product_sku_specs_value (attribute_value_id),
        CONSTRAINT fk_product_sku_specs_sku FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE CASCADE,
        CONSTRAINT fk_product_sku_specs_attribute FOREIGN KEY (attribute_id) REFERENCES product_attributes(id) ON DELETE CASCADE,
        CONSTRAINT fk_product_sku_specs_value FOREIGN KEY (attribute_value_id) REFERENCES product_attribute_values(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU规格映射表'`,

      `CREATE TABLE IF NOT EXISTS users (
        id BIGINT NOT NULL AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL,
        nickname VARCHAR(50) DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        email VARCHAR(100) DEFAULT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) DEFAULT NULL,
        gender TINYINT NOT NULL DEFAULT 0 COMMENT '0=未知,1=男,2=女',
        status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用,0=禁用',
        last_login_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_users_username (username),
        UNIQUE KEY uk_users_phone (phone),
        UNIQUE KEY uk_users_email (email),
        KEY idx_users_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商城前台用户表'`,

      `CREATE TABLE IF NOT EXISTS user_addresses (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        recipient_name VARCHAR(50) NOT NULL,
        recipient_phone VARCHAR(20) NOT NULL,
        province VARCHAR(50) NOT NULL,
        city VARCHAR(50) NOT NULL,
        district VARCHAR(50) DEFAULT NULL,
        detail_address VARCHAR(255) NOT NULL,
        postal_code VARCHAR(20) DEFAULT NULL,
        is_default TINYINT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_addresses_user (user_id),
        CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收货地址表'`,

      `CREATE TABLE IF NOT EXISTS shopping_carts (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_shopping_carts_user (user_id),
        CONSTRAINT fk_shopping_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车主表'`,

      `CREATE TABLE IF NOT EXISTS cart_items (
        id BIGINT NOT NULL AUTO_INCREMENT,
        cart_id BIGINT NOT NULL,
        product_id INT NOT NULL,
        sku_id BIGINT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        selected TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_cart_items_cart_sku (cart_id, sku_id),
        KEY idx_cart_items_product (product_id),
        KEY idx_cart_items_sku (sku_id),
        CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE,
        CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_cart_items_sku FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车明细表'`,

      `CREATE TABLE IF NOT EXISTS orders (
        id BIGINT NOT NULL AUTO_INCREMENT,
        order_no VARCHAR(40) NOT NULL,
        user_id BIGINT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        payable_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        status ENUM('pending_payment','paid','shipped','completed','cancelled','refunding','refunded') NOT NULL DEFAULT 'pending_payment',
        payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
        consignee_name VARCHAR(50) NOT NULL,
        consignee_phone VARCHAR(20) NOT NULL,
        shipping_address TEXT NOT NULL,
        remark VARCHAR(255) DEFAULT NULL,
        paid_at DATETIME DEFAULT NULL,
        shipped_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        cancelled_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_orders_order_no (order_no),
        KEY idx_orders_user (user_id),
        KEY idx_orders_status (status),
        CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表'`,

      `CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT NOT NULL AUTO_INCREMENT,
        order_id BIGINT NOT NULL,
        product_id INT DEFAULT NULL,
        sku_id BIGINT DEFAULT NULL,
        sku_code VARCHAR(100) DEFAULT NULL,
        sku_name VARCHAR(255) DEFAULT NULL,
        spec_summary JSON DEFAULT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_image VARCHAR(500) DEFAULT NULL,
        unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        quantity INT NOT NULL DEFAULT 1,
        line_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        source_platform VARCHAR(50) DEFAULT NULL,
        source_url VARCHAR(500) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_order_items_order (order_id),
        KEY idx_order_items_product (product_id),
        KEY idx_order_items_sku (sku_id),
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT fk_order_items_sku FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表'`,

      `CREATE TABLE IF NOT EXISTS return_requests (
        id BIGINT NOT NULL AUTO_INCREMENT,
        order_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        order_no VARCHAR(40) NOT NULL,
        order_status_before VARCHAR(50) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        admin_remark TEXT DEFAULT NULL,
        processed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_return_requests_order (order_id),
        KEY idx_return_requests_user (user_id),
        KEY idx_return_requests_status (status),
        CONSTRAINT fk_return_requests_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_return_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退货申请表'`
    ];

    await executeStatements(connection, ddlStatements);

    await connection.query('DELETE FROM operation_logs');
    await connection.query('DELETE FROM admin_users');
    await connection.query('DELETE FROM admin_roles');
    await connection.query('DELETE FROM order_items');
    await connection.query('DELETE FROM orders');
    await connection.query('DELETE FROM cart_items');
    await connection.query('DELETE FROM shopping_carts');
    await connection.query('DELETE FROM user_addresses');
    await connection.query('DELETE FROM users');

    const superAdminPassword = await bcrypt.hash('Admin@2026', 10);
    const adminPassword = await bcrypt.hash('Manager@2026', 10);
    const operatorPassword = await bcrypt.hash('Operator@2026', 10);
    const buyerPassword = await bcrypt.hash('Buyer@2026', 10);

    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      await connection.query(
        `INSERT INTO admin_roles (code, name, description, status, is_system, permissions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          role.code,
          role.name,
          role.description,
          Number(role.status ?? 1),
          Number(role.is_system ?? 0),
          JSON.stringify(role.permissions || [])
        ]
      );
    }

    await connection.query(
      `INSERT INTO admin_users (username, password, email, phone, role, status, created_at, updated_at)
       VALUES
       ('superadmin', ?, 'superadmin@agentmall.local', '13800000001', 'super_admin', 1, NOW(), NOW()),
       ('admin01', ?, 'admin01@agentmall.local', '13800000002', 'admin', 1, NOW(), NOW()),
       ('operator01', ?, 'operator01@agentmall.local', '13800000003', 'operator', 1, NOW(), NOW())`,
      [superAdminPassword, adminPassword, operatorPassword]
    );

    const [userInsert] = await connection.query(
      `INSERT INTO users (username, nickname, phone, email, password, gender, status, created_at, updated_at)
       VALUES ('buyer_demo', '演示买家', '13900000001', 'buyer_demo@agentmall.local', ?, 0, 1, NOW(), NOW())`,
      [buyerPassword]
    );

    const buyerUserId = userInsert.insertId;

    await connection.query(
      `INSERT INTO user_addresses
       (user_id, recipient_name, recipient_phone, province, city, district, detail_address, postal_code, is_default, created_at, updated_at)
       VALUES (?, '演示买家', '13900000001', '广东省', '深圳市', '南山区', '科技园科兴科学园A栋1001', '518000', 1, NOW(), NOW())`,
      [buyerUserId]
    );

    await connection.query(
      `INSERT INTO shopping_carts (user_id, created_at, updated_at)
       VALUES (?, NOW(), NOW())`,
      [buyerUserId]
    );

    await seedDefaultSkusForProducts(connection);

    await connection.commit();
    console.log('[bootstrap] done');
    console.log('superadmin / Admin@2026');
    console.log('admin01 / Manager@2026');
    console.log('operator01 / Operator@2026');
    console.log('buyer_demo / Buyer@2026');
  } catch (error) {
    await connection.rollback();
    console.error('[bootstrap] failed:', error);
    throw error;
  } finally {
    connection.release();
    await closePools();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

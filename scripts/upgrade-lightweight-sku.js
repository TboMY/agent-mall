require('dotenv').config();

const { mallPool, closePools } = require('../config/database');

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function hasConstraint(connection, tableName, constraintName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function ensureSkuTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS product_skus (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品SKU表'
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS product_sku_specs (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU规格映射表'
  `);
}

async function upgradeCartItems(connection) {
  await connection.query('DROP TABLE IF EXISTS cart_items');
  await connection.query(`
    CREATE TABLE cart_items (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车明细表'
  `);
}

async function upgradeOrderItems(connection) {
  await connection.query('DELETE FROM orders');
  await connection.query('DROP TABLE IF EXISTS order_items');
  await connection.query(`
    CREATE TABLE order_items (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表'
  `);
}

async function seedDefaultSkus(connection) {
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
    if (Number(rows[0]?.count || 0) > 0) {
      continue;
    }

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

    await connection.query(
      'UPDATE products SET sku = ?, updated_at = NOW() WHERE id = ?',
      [product.sku || `PRD${product.id}-DEFAULT`, product.id]
    );
  }
}

async function syncProductSummaryFields(connection) {
  const [products] = await connection.query(
    'SELECT id FROM products ORDER BY id ASC'
  );

  for (const product of products) {
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
    console.log('[sku-upgrade] start');
    await connection.beginTransaction();

    await ensureSkuTables(connection);
    await upgradeCartItems(connection);
    await upgradeOrderItems(connection);
    await seedDefaultSkus(connection);
    await syncProductSummaryFields(connection);

    await connection.commit();
    console.log('[sku-upgrade] done');
  } catch (error) {
    await connection.rollback();
    console.error('[sku-upgrade] failed:', error);
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

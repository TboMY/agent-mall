const { query } = require('../config/database');

class ProductSku {
  static async execute(sql, params = [], connection = null) {
    if (connection) {
      const [rows] = await connection.query(sql, params);
      return rows;
    }
    return query(sql, params);
  }

  // 获取单个 SKU
  static async getById(id, connection = null) {
    const sql = `
      SELECT
        ps.*,
        p.name AS product_name,
        p.status AS product_status
      FROM product_skus ps
      INNER JOIN products p ON p.id = ps.product_id
      WHERE ps.id = ?
      LIMIT 1
    `;
    const [row] = await this.execute(sql, [id], connection);
    if (!row) return null;
    row.spec_summary = this.parseJsonField(row.spec_summary);
    row.specs = await this.getSpecsBySkuId(row.id, connection);
    return row;
  }

  // 获取商品下的全部 SKU
  static async getByProductId(productId, connection = null) {
    const skuSql = `
      SELECT *
      FROM product_skus
      WHERE product_id = ?
      ORDER BY is_default DESC, sort_order ASC, id ASC
    `;
    const rows = await this.execute(skuSql, [productId], connection);
    if (!rows.length) {
      return [];
    }

    const specs = await this.getSpecsByProductId(productId, connection);
    const groupedSpecs = specs.reduce((acc, item) => {
      if (!acc[item.sku_id]) {
        acc[item.sku_id] = [];
      }
      acc[item.sku_id].push(item);
      return acc;
    }, {});

    return rows.map((row) => ({
      ...row,
      spec_summary: this.parseJsonField(row.spec_summary),
      specs: groupedSpecs[row.id] || []
    }));
  }

  // 获取某个 SKU 的规格映射
  static async getSpecsBySkuId(skuId, connection = null) {
    const sql = `
      SELECT
        pss.*,
        pa.name AS attribute_name,
        pa.attribute_key,
        pa.value_type,
        pav.value AS attribute_value,
        pav.label AS attribute_label
      FROM product_sku_specs pss
      LEFT JOIN product_attributes pa ON pa.id = pss.attribute_id
      LEFT JOIN product_attribute_values pav ON pav.id = pss.attribute_value_id
      WHERE pss.sku_id = ?
      ORDER BY pa.sort_order ASC, pss.id ASC
    `;
    return await this.execute(sql, [skuId], connection);
  }

  // 获取商品下全部 SKU 的规格映射
  static async getSpecsByProductId(productId, connection = null) {
    const sql = `
      SELECT
        pss.*,
        pa.name AS attribute_name,
        pa.attribute_key,
        pa.value_type,
        pav.value AS attribute_value,
        pav.label AS attribute_label
      FROM product_sku_specs pss
      INNER JOIN product_skus ps ON ps.id = pss.sku_id
      LEFT JOIN product_attributes pa ON pa.id = pss.attribute_id
      LEFT JOIN product_attribute_values pav ON pav.id = pss.attribute_value_id
      WHERE ps.product_id = ?
      ORDER BY ps.sort_order ASC, pa.sort_order ASC, pss.id ASC
    `;
    return await this.execute(sql, [productId], connection);
  }

  // 用新的 SKU 列表替换商品下已有 SKU
  static async replaceByProductId(connection, productId, productSnapshot, skus) {
    await connection.query('DELETE FROM product_skus WHERE product_id = ?', [productId]);

    const normalizedSkus = await this.normalizeSkus(connection, productId, productSnapshot, skus);

    for (const sku of normalizedSkus) {
      const [insertResult] = await connection.query(
        `INSERT INTO product_skus (
          product_id, sku_code, sku_name, price, original_price, stock,
          image, status, is_default, sort_order, spec_summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          productId,
          sku.sku_code,
          sku.sku_name,
          sku.price,
          sku.original_price,
          sku.stock,
          sku.image,
          sku.status,
          sku.is_default,
          sku.sort_order,
          JSON.stringify(sku.spec_summary || [])
        ]
      );

      for (const spec of sku.specs) {
        await connection.query(
          `INSERT INTO product_sku_specs (
            sku_id, attribute_id, attribute_value_id, custom_value, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [
            insertResult.insertId,
            spec.attribute_id,
            spec.attribute_value_id || null,
            spec.custom_value || null
          ]
        );
      }
    }

    return normalizedSkus;
  }

  // 根据 SKU 汇总商品层级价格、库存等冗余字段
  static summarizeForProduct(skus = []) {
    if (!skus.length) {
      return {
        price: 0,
        original_price: null,
        stock: 0,
        sku: ''
      };
    }

    const activeSkus = skus.filter((sku) => Number(sku.status) === 1);
    const candidates = activeSkus.length ? activeSkus : skus;
    const defaultSku = candidates.find((sku) => Number(sku.is_default) === 1) || candidates[0];
    const price = Math.min(...candidates.map((sku) => Number(sku.price || 0)));
    const originalPrices = candidates
      .map((sku) => (sku.original_price == null ? null : Number(sku.original_price)))
      .filter((value) => value != null);

    return {
      price,
      original_price: originalPrices.length ? Math.min(...originalPrices) : null,
      stock: candidates.reduce((sum, sku) => sum + Number(sku.stock || 0), 0),
      sku: defaultSku?.sku_code || ''
    };
  }

  // 扣减 SKU 库存
  static async decreaseStock(connection, skuId, quantity) {
    const [result] = await connection.query(
      `UPDATE product_skus
       SET stock = stock - ?, updated_at = NOW()
       WHERE id = ? AND stock >= ? AND status = 1`,
      [quantity, skuId, quantity]
    );
    return result.affectedRows > 0;
  }

  // 退货完成后回补 SKU 库存
  static async increaseStock(connection, skuId, quantity) {
    const [result] = await connection.query(
      `UPDATE product_skus
       SET stock = stock + ?, updated_at = NOW()
       WHERE id = ?`,
      [quantity, skuId]
    );
    return result.affectedRows > 0;
  }

  // 解析 JSON 字段
  static parseJsonField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  // 归一化 SKU 数据
  static async normalizeSkus(connection, productId, productSnapshot, skus) {
    if (!Array.isArray(skus) || skus.length === 0) {
      throw new Error('商品至少需要配置一个 SKU');
    }

    const source = skus;

    const normalized = [];

    for (let index = 0; index < source.length; index += 1) {
      const item = source[index] || {};
      const specs = Array.isArray(item.specs) ? item.specs : [];
      const specSummary = await this.buildSpecSummary(connection, specs);
      const derivedName = specSummary.length
        ? `${productSnapshot.name} ${specSummary.map((spec) => spec.value_label).join(' / ')}`
        : `${productSnapshot.name} 默认款`;

      normalized.push({
        sku_code: String(item.sku_code || `PRD${productId}-SKU${index + 1}`).trim(),
        sku_name: String(item.sku_name || derivedName).trim(),
        price: Number(item.price ?? 0),
        original_price: item.original_price == null || item.original_price === ''
          ? null
          : Number(item.original_price),
        stock: Math.max(0, Number(item.stock ?? 0)),
        image: item.image || productSnapshot.image || null,
        status: Number(item.status ?? 1),
        is_default: Number(item.is_default ?? (index === 0 ? 1 : 0)),
        sort_order: Number(item.sort_order ?? (index + 1) * 10),
        specs: specs.map((spec) => ({
          attribute_id: Number(spec.attribute_id),
          attribute_value_id: spec.attribute_value_id ? Number(spec.attribute_value_id) : null,
          custom_value: spec.custom_value || null
        })),
        spec_summary: specSummary
      });
    }

    if (!normalized.some((sku) => sku.is_default === 1)) {
      normalized[0].is_default = 1;
    } else {
      let foundDefault = false;
      normalized.forEach((sku) => {
        if (sku.is_default === 1 && !foundDefault) {
          foundDefault = true;
        } else if (sku.is_default === 1) {
          sku.is_default = 0;
        }
      });
    }

    const duplicatedCodes = new Set();
    normalized.forEach((sku) => {
      if (duplicatedCodes.has(sku.sku_code)) {
        throw new Error(`SKU 编码重复: ${sku.sku_code}`);
      }
      if (!sku.sku_name) {
        throw new Error('SKU 名称不能为空');
      }
      if (Number.isNaN(sku.price) || sku.price < 0) {
        throw new Error(`SKU 价格无效: ${sku.sku_code}`);
      }
      duplicatedCodes.add(sku.sku_code);
    });

    return normalized;
  }

  // 构建用于展示/下单的规格快照
  static async buildSpecSummary(connection, specs = []) {
    const summary = [];
    for (const spec of specs) {
      if (!spec?.attribute_id) continue;

      const [attributeRows] = await connection.query(
        'SELECT id, name, attribute_key FROM product_attributes WHERE id = ? LIMIT 1',
        [spec.attribute_id]
      );
      const attribute = attributeRows[0];
      if (!attribute) continue;

      let valueLabel = spec.custom_value || '';
      if (spec.attribute_value_id) {
        const [valueRows] = await connection.query(
          'SELECT id, value, label FROM product_attribute_values WHERE id = ? LIMIT 1',
          [spec.attribute_value_id]
        );
        const attributeValue = valueRows[0];
        if (attributeValue) {
          valueLabel = attributeValue.label || attributeValue.value;
        }
      }

      summary.push({
        attribute_id: Number(attribute.id),
        attribute_name: attribute.name,
        attribute_key: attribute.attribute_key,
        attribute_value_id: spec.attribute_value_id ? Number(spec.attribute_value_id) : null,
        value_label: valueLabel,
        custom_value: spec.custom_value || null
      });
    }
    return summary;
  }
}

module.exports = ProductSku;

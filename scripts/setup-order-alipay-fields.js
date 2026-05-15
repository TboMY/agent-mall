require('dotenv').config();
const { query, closePools } = require('../config/database');

async function ensureColumn(tableName, columnName, definition) {
  const rows = await query(`SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`);
  if (rows.length) return;
  await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function main() {
  await ensureColumn('orders', 'payment_channel', "VARCHAR(32) DEFAULT NULL COMMENT '支付渠道'");
  await ensureColumn('orders', 'trade_no', "VARCHAR(128) DEFAULT NULL COMMENT '第三方支付流水号'");
  await ensureColumn('orders', 'buyer_logon_id', "VARCHAR(128) DEFAULT NULL COMMENT '买家支付宝账号脱敏值'");
  await ensureColumn('orders', 'trade_status', "VARCHAR(64) DEFAULT NULL COMMENT '第三方支付状态'");
  await ensureColumn('orders', 'raw_payment_notify', "JSON DEFAULT NULL COMMENT '支付回调原始报文'");

  console.log('✅ orders 支付字段已准备完成');
}

main()
  .catch(async (error) => {
    console.error('❌ 初始化订单支付字段失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePools();
  });

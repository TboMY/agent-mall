require('dotenv').config();
const mysql = require('mysql2/promise');

// 商城主库（agent_mall）配置
const mallDbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agent_mall',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0
};

// 爬虫库（media_crawler）配置
const crawlerDbConfig = {
  host: process.env.CRAWLER_DB_HOST || process.env.DB_HOST || '127.0.0.1',
  user: process.env.CRAWLER_DB_USER || process.env.DB_USER || 'root',
  password: process.env.CRAWLER_DB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.CRAWLER_DB_NAME || 'media_crawler',
  port: Number(process.env.CRAWLER_DB_PORT || process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.CRAWLER_DB_CONNECTION_LIMIT || process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0
};

// 打印数据库连接信息（掩码敏感信息）
console.log('🔗 数据库连接配置:');
console.log(`   商城库: ${mallDbConfig.host}:${mallDbConfig.port}/${mallDbConfig.database} user=${mallDbConfig.user}`);
console.log(`   爬虫库: ${crawlerDbConfig.host}:${crawlerDbConfig.port}/${crawlerDbConfig.database} user=${crawlerDbConfig.user}`);

// 创建连接池
const mallPool = mysql.createPool(mallDbConfig);
const crawlerPool = mysql.createPool(crawlerDbConfig);

// 测试数据库连接
async function testConnection() {
  try {
    const c1 = await mallPool.getConnection();
    console.log('✅ 商城库连接成功');
    c1.release();
    const c2 = await crawlerPool.getConnection();
    console.log('✅ 爬虫库连接成功');
    c2.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}

// 执行查询的通用方法
async function query(sql, params = []) {
  try {
    const [rows] = await mallPool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

// 爬虫库查询
async function crawlerQuery(sql, params = []) {
  try {
    const [rows] = await crawlerPool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('爬虫数据库查询错误:', error);
    throw error;
  }
}

// 执行事务
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  mallPool,
  crawlerPool,
  query,
  crawlerQuery,
  transaction,
  testConnection
};

const { testConnection } = require('./config/database');

async function startServer() {
  console.log('🚀 启动AI商城后台服务...\n');

  // 测试数据库连接
  console.log('📊 检查数据库连接...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('❌ 数据库连接失败，请检查配置');
    process.exit(1);
  }

  // 启动服务器
  const app = require('./app');
  const port = process.env.PORT || 3000;
  
  app.listen(port, () => {
    console.log(`✅ 服务器启动成功！`);
    console.log(`🌐 服务地址: http://localhost:${port}`);
    console.log(`📚 API文档: http://localhost:${port}/api`);
    console.log(`\n📋 可用的API端点:`);
    console.log(`   GET    /api/products          - 获取商品列表`);
    console.log(`   GET    /api/products/:id       - 获取商品详情`);
    console.log(`   POST   /api/products          - 创建商品`);
    console.log(`   PUT    /api/products/:id       - 更新商品`);
    console.log(`   DELETE /api/products/:id       - 删除商品`);
    console.log(`   GET    /api/categories         - 获取分类列表`);
    console.log(`   GET    /api/brands             - 获取品牌列表`);
  });
}

startServer().catch(error => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});

const a=`
{
  "is_valuable": true,
  "product_info": {
    "name": "可爱卡通造型无线门铃",
    "reason": "外观设计萌趣，安装便捷无需布线，音量可调且自带38首悦耳铃声，提升居家仪式感，适合作为乔迁礼物。",
    "category": "10"
  }
}
`

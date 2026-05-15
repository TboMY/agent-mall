# 基于大语言模型的智能选品系统 - 后端



---

这是一个毕业设计项目的后端系统，主要实现了一个基于大语言模型(LLM)的智能选品系统。通过AI技术从抖音等短视频平台中短视频内容中识别有潜在商业价值的商品，推荐给选品运营人员审核。

系统采用Node.js + Express框架开发,使用MySQL数据库存储数据,通过阿里云通义千问VL-plus多模态大模型进行视频分析。

以下内容将详细介绍系统的架构设计和、代码结构和技术实现。

## 一、项目概述

随着电商行业的快速发展,抖音、小红书等短视频平台已成为重要的商品推广和渠道。如何从海量视频内容中快速筛选出有商业价值的商品,成为电商运营的关键问题。本系统利用大语言模型(LLM)和多模态视频分析技术,实现了智能选品功能.

通过爬虫爬取抖音视频数据,使用AI分析视频内容,判断是否包含有价值的商品,提取商品信息并计算热度分数,推荐到候选池供运营人员审核,审核通过的候选商品可以转换为正式商品上架到商城中销售.

系统核心功能包括:
- **AI视频分析**: 使用多模态大模型分析抖音视频内容,判断视频商业价值
- **商品信息提取**: 从视频中提取商品名称、推荐理由、分类等信息
- **热度评分**: 根据互动数据和时间衰减计算加权热度分数
- **候选商品管理**: AI推荐商品的审核、转换和状态管理
- **商品管理**: 完整的CRUD操作,支持分类、品牌、商品类型等
- **系统配置**: 支持定时任务和推荐策略等参数配置

## 二、技术栈
### 后端框架
- **Node.js** - JavaScript运行时
- **Express** - Web应用框架
- **MySQL2** - MySQL数据库驱动
### AI服务
- **阿里云通义千问 VL-plus** - 多模态视频分析API
- **OpenAI SDK** - LLM API调用
### 开发工具
- **dotenv** - 环境变量管理
- **morgan** - 日志中间件
- **cors** - 跨域资源共享
- **joi** - 数据验证
- **multer** - 文件上传处理
- **sharp** - 图像处理

### 数据验证
- **bcryptjs** - 密码加密
- **jsonwebtoken** - JWT认证
- **cookie-parser** - Cookie解析

## 三、项目结构
```
agent-mall/
├── bin/
│   └── www                    # 启动脚本
├── config/
│   ├── agent-mall.sql       # 商城数据库初始化脚本
│   ├── agent-mall-crawler.sql # 采集模块数据库补充脚本
│   ├── database.js        # 数据库连接配置
│   ├── init_default_configs.sql  # 系统默认配置初始化
│   └── llm.js             # LLM API配置
├── middleware/
│   └── validation.js        # 数据验证中间件
├── models/
│   ├── AIProductCandidate.js  # AI推荐候选商品模型
│   ├── Brand.js             # 品牌模型
│   ├── Category.js          # 分类模型
│   ├── Product.js            # 商品模型
│   ├── ProductAttribute.js  # 商品属性模型
│   ├── ProductSpecification.js    # 商品规格模型
│   ├── ProductType.js       # 商品类型模型
│   ├── SourceContentItem.js  # 采集内容模型
│   └── SystemConfig.js       # 系统配置模型
├── crawler/
│   ├── app.js                # 采集服务HTTP应用
│   ├── init-db.js            # 采集表初始化脚本
│   ├── run.js                # 一次性采集命令
│   └── start.js              # 常驻采集服务入口
├── prompts/
│   ├── aiResponseTemplates.js  # AI响应模板
│   └── buildPrompt.js        # 提示词构建
├── public/
│   └── stylesheets/
│       └── style.css        # 样式文件
├── routes/
│   ├── aiCandidates.js   # AI推荐候选商品路由
│   ├── aweme.js           # 视频分析路由
│   ├── brands.js          # 品牌路由
│   ├── categories.js      # 分类路由
│   ├── index.js            # 韖页路由
│   ├── productAttributes.js  # 商品属性路由
│   ├── products.js         # 商品路由
│   ├── productTypes.js      # 商品类型路由
│   ├── systemConfigs.js   # 系统配置路由
│   └── users.js            # 用户路由
├── services/
│   ├── LLMService.js      # 大语言模型服务
│   ├── PromptService.js   # 提示词服务
│   └── Scheduler.js        # 定时任务调度器
├── utils/
│   └── scoreCalculator.js  # 热度分数计算器
└── views/
    ├── error.jade        # 错误页面模板
    ├── index.jade         # 首页模板
    └── layout.jade       # 布局模板
```

## 四、核心模块说明

### 4.1 数据库设计
系统采用单数据库架构:
- **agent-mall**: 同时存储商城业务数据与采集内容数据

数据库表结构详见 `config/agent-mall.sql` 和 `config/agent-mall-crawler.sql`。

### 4.2 AI视频分析流程
1. 采集模块抓取抖音/B站内容并写入 `source_content_items` 表
2. 定时任务或手动触发拉取待分析的内容
发送到AI服务进行分析
3. AI分析视频内容,判断商业价值并提取商品信息
4. 计算热度分数,存入 `ai_product_candidate` 表
5. 运营人员审核候选商品
6. 审核通过的商品转换为正式商品上架销售

### 4.3 热度评分算法
热度分数根据以下因素计算:
- **互动数据**: 点赞数、评论数、分享数、收藏数
- **时间衰减**: 使用指数衰减函数,半衰期10天
- **加权计算**: 不同互动数据赋予不同权重
- **归一化**: 将分数映射到0-100范围

支持三种推荐策略:
- **爆款优先**: 高点赞、高分享权重
- **深度互动优先**: 高评论、高收藏权重
- **新鲜度优先**: 强时效衰减

## 五、源代码

### 5.1 应用入口 (app.js)
```javascript
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var productsRouter = require('./routes/products');
var categoriesRouter = require('./routes/categories');
var brandsRouter = require('./routes/brands');
var productTypesRouter = require('./routes/productTypes');
var productAttributesRouter = require('./routes/productAttributes');
var awemeRouter = require('./routes/aweme');
var aiCandidatesRouter = require('./routes/aiCandidates');
var systemConfigsRouter = require('./routes/systemConfigs');
var Scheduler = require('./services/Scheduler');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// 中间件
app.use(logger('dev'));
app.use(cors()); // 启用CORS
app.use(express.json({ limit: '10mb' })); // 增加JSON解析限制
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.use('/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/product-types', productTypesRouter);
app.use('/api/product-attributes', productAttributesRouter);
app.use('/api/aweme', awemeRouter);
app.use('/api/ai-candidates', aiCandidatesRouter);
app.use('/api/system-configs', systemConfigsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

// 初始化定时任务（在应用加载后）
Scheduler.init && Scheduler.init();
```

### 5.2 数据库配置 (config/database.js)
```javascript
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

// 打印数据库连接信息（掩码敏感信息）
console.log('🔗 数据库连接配置:');
console.log(`   商城库: ${mallDbConfig.host}:${mallDbConfig.port}/${mallDbConfig.database} user=${mallDbConfig.user}`);

// 创建连接池
const mallPool = mysql.createPool(mallDbConfig);

// 测试数据库连接
async function testConnection() {
  try {
    const c1 = await mallPool.getConnection();
    console.log('✅ 商城库连接成功');
    c1.release();
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

// 执行事务
async function transaction(callback) {
  const connection = await mallPool.getConnection();
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
  query,
  transaction,
  testConnection
};
```

### 5.3 LLM配置 (config/llm.js)
```javascript
require('dotenv').config();

module.exports = {
  baseURL: process.env.LLM_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  model: process.env.LLM_MODEL || 'qwen3-vl-plus',
  temperature: Number(process.env.LLM_TEMPERATURE || '0')
};
```

### 5.4 LLM服务 (services/LLMService.js)
```javascript
require('dotenv').config();
const OpenAI = require('openai');
const llmConf = require('../config/llm');

class LLMService {
  constructor() {
    this.apiBase = llmConf.baseURL;
    this.apiKey = llmConf.apiKey;
    this.model = llmConf.model;
    this.temperature = llmConf.temperature;
    this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.apiBase });
  }


  async chatJson({ system, user, responseFormat = 'json_object' }) {
    if (!this.apiBase || !this.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages: [
        system ? { role: 'system', content: system } : null,
        { role: 'user', content: user }
      ].filter(Boolean)
    });
    return response.choices?.[0]?.message?.content;
  }

  async chatWithVideo({ system, text, videoUrl, responseFormat = 'json_object' }) {
    if (!this.apiBase || !this.apiKey) {
      throw new Error('LLM API 配置缺失: 请设置 LLM_API_BASE 与 LLM_API_KEY');
    }
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({
      role: 'user',
      content: [
        { type: 'video_url', video_url: { url: videoUrl } },
        { type: 'text', text }
      ]
    });
    const response = await this.client.chat.completions.create({
      model: this.model || 'qwen3-vl-plus',
      temperature: this.temperature,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      messages
    });
    return response.choices?.[0]?.message?.content;
  }
}

module.exports = new LLMService();
```

### 5.5 提示词服务 (services/PromptService.js)
```javascript
const { buildVideoAnalysisPrompt } = require('../prompts/buildPrompt')
const { valuableVideoTemplate } = require('../prompts/aiResponseTemplates')

class PromptService {
  constructor () {
    this.valuableVideoTemplate = valuableVideoTemplate
 this.buildSystemPrompt ({ categoryOptions = [] } = {} ) {
    const videoData = {
      title: '',
      desc: '',
      source_keyword: ''
    }
    return buildVideoAnalysisPrompt(videoData, categoryOptions, this.valuableVideoTemplate)
 this.buildUserPromptFromAweme ({ aweme, tags = [] }) {
    const videoData = {
      title: aweme?.title || '',
      desc: aweme?.desc || '',
      source_keyword: aweme?.source_keyword || '',
    }
    return videoData
  }

  // 使用实际数据库数据与分类，生成完整可发送到大模型的 Prompt 文本
  buildFullPromptForAweme ({ aweme, categoryOptions = [], tags = [] }) {
    const videoData = this.buildUserPromptFromAweme({ aweme, tags })
    return buildVideoAnalysisPrompt(videoData, categoryOptions, this.valuableVideoTemplate)
  }
}
module.exports = new PromptService()
```

### 5.6 提示词构建 (prompts/buildPrompt.js)
```javascript
/**
 * 构建用于大模型分析的完整 Prompt
 * @param {Object} videoData - 来自 source_content_items 表的一行数据
 * @param {string[]} categories - 商品分类列表（从商城数据库动态获取）
 * @param {Object} outputExample - 输出示例（如 valuableVideoTemplate）
 * @returns {string} 完整的 Prompt 字符串
 */
function buildVideoAnalysisPrompt (videoData, categories, outputExample) {
  const template = `
你是一个专业的电商选品分析师，你的任务是从提供的抖音视频信息中，判断该视频是否包含值得推荐的、有潜在商业价值的商品，并提取相关商品信息。

请仔细阅读以下视频信息：
- 视频标题: ${videoData.title || ''}
- 视频描述/文案: ${videoData.desc || ''}
- 关键词: ${videoData.source_keyword}

你的工作流程如下：
1. **视频价值判断**: 首先，判断这个视频的主要目的是否是"推销"、"展示"、"分享"某个具体的、可购买的商品（例如：服装、美妆、电子产品、食品、小玩具、日常实用工具等）。纯粹的搞笑、才艺表演、知识科普、风景记录等非商品导向的内容，不属于有价值的视频。
   - 判断标准：视频内容是否聚焦于某个具体物品？是否在展示其功能、外观、使用场景？
2. **商品信息提取**: 如果视频有价值，请尝试提取出其中的核心商品信息。如果视频中没有明确指向的商品，或者商品信息模糊不清，按照无价值处理。
   - 商品名称: 尽可能准确地描述视频中展示的核心商品（例如："蓝色比基尼泳装"、"三亚度假风连衣裙"、"某品牌防晒霜"）。如果无法确定具体名称，你拟定一个合适的商品名。
   - 推荐理由: 用一段话概括为什么这个商品值得关注或有潜力（例如："符合夏日海边穿搭潮流"、"设计独特,容易引发用户共鸣"、"与热门话题#三亚 关联度高"），不超过60字。
   - 商品分类: 给出一个最合适的商品大类的id。必须从以下分类中选择一个分类，然后返回你选择的那个分类的id：
${categories.map(c => `     - ${c.id}: ${c.name}`).join('\n')}

**输出要求**:
请严格按照JSON格式输出结果,不要包含任何额外的解释或文字。JSON对象必须包含以下字段：
- `is_valuable`: 布尔值。true 表示有价值,false 表示无价值。
 - `product_info`: 对象。当 is_valuable 为 true 时,必须包含 name, reason, category；否则为空对象 {}。**有价值输出示例**:
${JSON.stringify(outputExample)}
  `.trim()
  return template
 }
module.exports = {
  buildVideoAnalysisPrompt
}
```

### 5.7 定时任务调度器 (services/Scheduler.js)
```javascript
const axios = require('axios')
const SystemConfig = require('../models/SystemConfig')


// 简单的定时任务调度器：根据配置的每天执行时间触发一次AI分析
class Scheduler {
  constructor () {
    this.currentTimer = null
    this.lastPlannedAt = null
  }

  async init () {
    await this.reset()
  }

  async reset () {
    // 清理上一个未执行的任务
 this.clear() try {
      const cfg = await SystemConfig.getAIWorkbenchConfig()
      const enabled = !!cfg?.scheduledTask?.enabled
      const timeStr = cfg?.scheduledTask?.executionTime || '00:00'
      if (!enabled) {
        console.log('[Scheduler] 定时任务未启用，已跳过')
        return
 }
      const nextTime = this.computeNextRunTime(timeStr)
      const delayMs = Math.max(0, nextTime.getTime() - Date.now())
      this.lastPlannedAt = nextTime
      this.currentTimer = setTimeout(async () => {
        this.currentTimer = null
        await this.runOnceSafely()
        // 运行完成后，按配置再次计划下一次
        await this.reset()
      }, delayMs)
      console.log(`[Scheduler] 已安排下次AI分析时间: ${nextTime.toLocaleString()}`)
    } catch (e) {
      console.error('[Scheduler] 重置任务失败:', e)    }
  }

  clear () {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer)
      this.currentTimer = null
      console.log('[Scheduler] 已清理未执行的定时任务')
    }
  }

  computeNextRunTime (hhmm) {
    const [hh, mm] = String(hhmm || '00:00').split(':').map(s => parseInt(s, 10) || 0)
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
    if (next.getTime() <= now.getTime()) {
      // 已过今天时间，安排到明天
 next.setDate(next.getDate() + 1)
    }
    return next
  }

  async runOnceSafely () {
    try {
      const port = process.env.PORT || 3000
      const baseURL = process.env.SCHEDULER_BASE_URL || `http://localhost:${port}`
      console.log('[Scheduler] 触发AI分析(定时模式): POST /api/aweme/analyze')
      await axios.post(`${baseURL}/api/aweme/analyze`, { scheduled: true })
      console.log('[Scheduler] AI分析触发完成')    } catch (e) {
      console.error('[Scheduler] 触发AI分析失败:', e?.response?.data || e.message)
    }
  }
}
module.exports = new Scheduler()
```

### 5.8 热度分数计算器 (utils/scoreCalculator.js)
```javascript
/**
 * 计算AI推荐商品的热度分数
 * @param {Object} params - 参数对象
 * @param {number} params.liked_count - 点赞数
 * @param {number} params.comment_count - 评论数
 * @param {number} params.share_count - 分享数
 * @param {number} params.collected_count - 收藏数
 * @param {number} params.create_time - 创建时间（秒级时间戳）
 * @returns {number} 热度分数（0-100）
 */
function calculateProductScore({
  liked_count,
 comment_count, share_count, collected_count, create_time
 {
  const now = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
  // 安全转为整数
  const liked = parseInt(liked_count, 10) || 0;
  const comment = parseInt(comment_count, 10) || 0;
  const share = parseInt(share_count, 10) || 0;
  const collect = parseInt(collected_count, 10) || 0;
  // 1. 加权互动分（整体抬升权重）
  const rawScore =
    1.2 * liked +
    8.0 * comment +
    5.0 * share +
    6.0 * collect;
  // 2. 时间衰减（放缓衰减：半衰期10天 = 240小时），并对缺失时间做兜底
  const safeCreate = Number(create_time);
  const ageHours = Number.isFinite(safeCreate) && safeCreate > 0 ? (now - safeCreate) / 3600 : 0;
  const decayFactor = Math.exp(-ageHours / 240);
  const decayedScore = rawScore * decayFactor;
  // 3. 对数压缩 + 归一化到 0~100，并设置轻微的下限抬升
  if (decayedScore <= 0) return 0;
  const logScore = Math.log1p(decayedScore); // ln(1 + x)
  const cappedLog = Math.min(logScore, 25);  // 上限放宽
  let finalScore = (cappedLog / 25) * 100;
  // 软下限：如果互动量明显>0，最低给到10分
  if (finalScore < 10 && (liked + comment + share + collect) > 0) {
      finalScore = 10;
    }
    return Math.round(finalScore); // 取整数
}
/**
 * 根据推荐策略计算加权分数
 * @param {Object} params - 基础参数
 * @param {string} strategy - 推荐策略
 * @returns {number} 加权后的分数
 */
function calculateWeightedScore(params, strategy = 'viral_priority') {
  const baseScore = calculateProductScore(params);

  // 根据不同的推荐策略应用不同的权重
  switch (strategy) {
    case 'viral_priority': // 爆款优先：高点赞、高转发权重
      return baseScore; // 使用原始分数,因为原始算法已经考虑了点赞和转发
    case 'engagement_priority': // 深度互动优先：高评论、高收藏权重
      const engagementScore =
        1.0 * (params.liked_count || 0) +
        8.0 * (params.comment_count || 0) + // 提高评论权重
        3.0 * (params.share_count || 0) +
        6.0 * (params.collected_count || 0); // 提高收藏权重

      const now = Math.floor(Date.now() / 1000);
      const safeCreate = Number(params.create_time);
      const ageHours = Number.isFinite(safeCreate) && safeCreate > 0 ? (now - safeCreate) / 3600 : 1;
      const decayFactor = Math.exp(-ageHours / 240);
      const decayedEngagementScore = engagementScore * decayFactor;

      if (decayedEngagementScore <= 0) return 0;
      const logScore = Math.log1p(decayedEngagementScore);
      const cappedLog = Math.min(logScore, 20);
      return Math.round((cappedLog / 20) * 100); // 取整数
    case 'freshness_priority': // 新鲜度优先:强时效衰减
      const now2 = Math.floor(Date.now() / 1000);
      const safeCreate2 = Number(params.create_time);
      const ageHours2 = Number.isFinite(safeCreate2) && safeCreate2 > 0 ? (now2 - safeCreate2) / 3600 : 1;
      const decayFactor2 = Math.exp(-ageHours2 / 72); // 3天半衰期,稍放缓但仍强调新鲜度
      const freshScore = baseScore * decayFactor2;
      return Math.round(freshScore); // 取整数
    default:
      return baseScore;
  }
}
module.exports = {
  calculateProductScore,
  calculateWeightedScore
};
```

## 六、API接口文档
### 6.1 商品管理接口
```
GET /api/products              获取商品列表
    - 参数: page, limit, search, category_id, brand_id, status, is_ai_recommended, sort_by, sort_order
    - 响应: { success: true, data: [], pagination: {} }


GET /api/products/:id            获取商品详情
    - 参数: id (路径参数)
    - 响应: { success: true, data: {} }


POST /api/products             创建商品
    - 请求体: name, description, price, image, category_id, brand_id, product_type_id, specifications, stock, etc.
    - 响应: { success: true, message: '商品创建成功', data: { id } }


PUT /api/products/:id            更新商品
    - 参数: id (路径参数)
    - 请求体: 同创建接口
    - 响应: { success: true, message: '商品更新成功' }


DELETE /api/products/:id         删除商品
    - 参数: id (路径参数)
    - 响应: { success: true, message: '商品删除成功' }


DELETE /api/products             批量删除商品
    - 请求体: { ids: [] }
    - 响应: { success: true, message: '成功删除 N 个商品' }


PATCH /api/products/:id/status   更新商品状态
    - 参数: id (路径参数)
    - 请求体: { status: 0|1 }
    - 响应: { success: true, message: '商品状态更新成功' }


PATCH /api/products/:id/stock    更新商品库存
    - 参数: id (路径参数)
    - 请求体: { stock: number }
    - 响应: { success: true, message: '商品库存更新成功' }


GET /api/products/ai/recommended 获取AI推荐商品
    - 参数: limit (默认10)
    - 响应: { success: true, data: [] }


GET /api/products/hot              获取热门商品
    - 参数: limit (默认10)
    - 响应: { success: true, data: [] }
```

### 6.2 分类管理接口
```
GET /api/categories            获取所有分类
    - 响应: { success: true, data: [] }


GET /api/categories/tree        获取分类树形结构
    - 响应: { success: true, data: [] }


GET /api/categories/:id        获取分类详情
    - 响应: { success: true, data: {} }


POST /api/categories           创建分类
    - 请求体: name, parent_id, level, sort_order, icon, description, status
    - 响应: { success: true, message: '分类创建成功', data: { id } }


PUT /api/categories/:id        更新分类
    - 响应: { success: true, message: '分类更新成功' }


DELETE /api/categories/:id     删除分类
    - 响应: { success: true, message: '分类删除成功' }
```

### 6.3 噪音管理接口
```
GET /api/brands                 获取所有品牌
    - 响应: { success: true, data: [] }


GET /api/brands/:id             获取品牌详情
    - 响应: { success: true, data: {} }


POST /api/brands                创建品牌
    - 请求体: name, logo, description, website, status
    - 响应: { success: true, message: '品牌创建成功', data: { id } }


PUT /api/brands/:id             更新品牌
    - 响应: { success: true, message: '品牌更新成功' }


DELETE /api/brands/:id          删除品牌
    - 响应: { success: true, message: '品牌删除成功' }
```

### 6.4 AI视频分析接口
```
POST /api/aweme/analyze          分析抖音视频
    - 请求体: { scheduled: boolean, mode: string } (可选)
    - 响应: { success: true, count: number, results: [] }
```

### 6.5 AI候选商品接口
```
GET /api/ai-candidates          获取AI推荐候选商品列表
    - 参数: page, limit, search, status, product_name, sort_by, sort_order, start_time, end_time
    - 响应: { success: true, data: [], pagination: {} }


GET /api/ai-candidates/:id      获取候选商品详情
    - 响应: { success: true, data: {} }


PATCH /api/ai-candidates/:id/status  更新候选商品状态
    - 请求体: { status: 0|1|2 }
    - 响应: { success: true, message: '候选商品状态更新成功' }


PATCH /api/ai-candidates/batch/status 批量更新候选商品状态
    - 请求体: { ids: [], status: 0|1|2 }
    - 响应: { success: true, message: '成功更新 N 个候选商品状态' }


POST /api/ai-candidates/:id/convert 将候选商品转换为正式商品
    - 请求体: { category_id, price, brand_id, product_type_id, ... }
    - 响应: { success: true, message: '候选商品已成功转换为正式商品', data: { productId } }


GET /api/ai-candidates/stats/overview 获取统计信息
    - 响应: { success: true, data: { total, pending, approved, rejected, avg_hot_score } }


DELETE /api/ai-candidates/:id   删除候选商品
    - 响应: { success: true, message: '候选商品删除成功' }
```

### 6.6 系统配置接口
```
GET /api/system-configs           获取所有配置
    - 响应: { success: true, data: [] }


GET /api/system-configs/ai-workbench 获取AI工作台配置
    - 响应: { success: true, data: {} }


POST /api/system-configs/ai-workbench 保存AI工作台配置
    - 请求体: { scheduledTask: {}, manualTrigger: {}, aiModel: {} }
    - 响应: { success: true, message: 'AI工作台配置保存成功', data: [] }
```

## 七、数据模型

### 7.1 Product模型 (models/Product.js)
```javascript
const { query } = require('../config/database');
const ProductSpecification = require('./ProductSpecification');

class Product {
  // 获取商品列表（支持分页、搜索、筛选）
  static async getProducts(options = {}) {
    const {
      page = 1, limit = 10, search = '',
      category_id = null, brand_id = null, status = null,
      is_ai_recommended = null,
      sort_by = 'created_at', sort_order = 'DESC'
    } = options;
    // ... 实现分页查询逻辑
 }

  // 根据ID获取商品详情
  static async getById(id) { /* ... */ }

  // 创建商品
  static async create(productData) { /* ... */ }

  // 更新商品
  static async update(id, productData) { /* ... */ }

  // 删除商品
  static async delete(id) { /* ... */ }

  // 获取AI推荐商品
  static async getAIRecommended(limit = 10) { /* ... */ }

  // 获取热门商品
  static async getHotProducts(limit = 10) { /* ... */ }
}
module.exports = Product;
```

### 7.2 AIProductCandidate模型 (models/AIProductCandidate.js)
```javascript
const { query } = require('../config/database');

class AIProductCandidate {
  // 获取AI推荐候选商品列表
  static async getCandidates(options = {}) { /* ... */ }

  // 根据ID获取候选商品详情
  static async getById(id) { /* ... */ }

  // 创建候选商品
  static async create(candidateData) { /* ... */ }

  // 更新候选商品
  static async update(id, candidateData) { /* ... */ }

  // 批量更新候选商品状态
  static async batchUpdateStatus(ids, status) { /* ... */ }

  // 将候选商品转换为正式商品
  static async convertToProduct(candidateId, productData) { /* ... */ }

  // 获取统计信息
  static async getStats() { /* ... */ }
}
module.exports = AIProductCandidate;
```

## 八、配置说明

### 8.1 环境变量配置 (.env)
复制项目根目录下的 `.env.example` 为 `.env`，配置以下环境变量：
```bash
# 数据库配置
DB_HOST=127.0.0.1
 DB_PORT=3306
 DB_USER=root
 DB_PASSWORD=your密码
 DB_NAME=agent_mall
 DB_CONNECTION_LIMIT=10

# 采集器配置（抖音开发Chrome）
COLLECTOR_DOUYIN_BROWSER_MODE=cdp
 COLLECTOR_DOUYIN_CDP_URL=http://127.0.0.1:9222
 COLLECTOR_DOUYIN_EXECUTABLE_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
 COLLECTOR_DOUYIN_USER_DATA_DIR=D:\About_Browser\dev_user_data
 COLLECTOR_DOUYIN_REMOTE_DEBUGGING_PORT=9222
 COLLECTOR_HEADLESS=false
 # LLM配置
LLM_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=您的API密钥
LLM_MODEL=qwen3-vl-plus
 LLM_TEMPERATURE=0
 # 服务配置
PORT=3000
 SCHEDULER_BASE_URL=http://localhost:3000
```

### 8.2 定时任务配置
定时任务相关配置存储在 `system_configs` 表中,通过API可以动态修改:

默认配置如下:
```json
{
  "scheduledTask": {
    "enabled": true,
    "productCount": 50,
    "executionTime": "00:00",
    "platforms": ["bilibili", "douyin", "xiaohongshu"]
  },
  "manualTrigger": {
    "productCount": 10,
    "platforms": ["bilibili", "douyin"]  },
  "aiModel": {
    "recommendationThreshold": 70,
    "recommendationStrategy": "viral_priority"
  },
  "crawlerState": {
    "lastAwemeRowId": 0
  }
}
```

## 九、完整源代码

由于篇幅限制,完整源代码请查看项目源文件。以下列出剩余的源代码文件:

### 9.1 路由文件
- `routes/aiCandidates.js` - AI候选商品路由
- `routes/aweme.js` - 视频分析路由
- `routes/brands.js` - 品牌路由
- `routes/categories.js` - 分类路由
- `routes/productAttributes.js` - 商品属性路由
- `routes/productTypes.js` - 商品类型路由
- `routes/products.js` - 商品路由
- `routes/systemConfigs.js` - 系统配置路由



### 9.2 模型文件
- `models/AIProductCandidate.js` - AI候选商品模型
- `models/Brand.js` - 品牌模型
- `models/Category.js` - 分类模型
- `models/SourceContentItem.js` - 采集内容模型
- `models/Product.js` - 商品模型
- `models/ProductAttribute.js` - 商品属性模型
- `models/ProductSpecification.js` - 商品规格模型
- `models/ProductType.js` - 商品类型模型
- `models/SystemConfig.js` - 系统配置模型
            ### 9.3 服务文件
- `services/LLMService.js` - 大语言模型服务
- `services/PromptService.js` - 提示词服务
- `services/Scheduler.js` - 定时任务调度器
            ### 9.4 工具文件
- `utils/scoreCalculator.js` - 热度分数计算器
### 9.5 中间件文件
- `middleware/validation.js` - 数据验证中间件
### 9.6 Prompts文件
- `prompts/aiResponseTemplates.js` - AI响应模板
- `prompts/buildPrompt.js` - 提示词构建
### 9.7 配置文件
- `config/database.js` - 数据库配置
- `config/llm.js` - LLM配置
- `config/agent-mall.sql` - 商城数据库结构
- `config/agent-mall-crawler.sql` - 采集模块表结构
- `config/init_default_configs.sql` - 系统默认配置
            ## 十、数据库设计
### 10.1 商城数据库 (agent_mall)
#### admin用户表 (admin_users)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键,自增 |
| username | varchar(50) | 用户名 |
| password | varchar(255) | 密码(加密) |
| email | varchar(100) | 邮箱 |
| phone | varchar(20) | 手机号 |
| role | enum | 角色: super_admin, admin, operator |
| status | tinyint(1) | 状态: 1=启用, 0=禁用 |
| last_login_at | datetime | 最后登录时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

#### AI候选商品表 (ai_product_candidate)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键,自增 |
| aweme_id | bigint | 源作品ID |
| product_name | varchar(255) | AI提取的商品名称 |
| product_category | varchar(100) | 商品分类 |
| ai_reason | text | AI推荐理由 |
| hot_score | decimal(5,2) | 热度分(0-100) |
| status | tinyint | 0=待审核, 1=已上架, 2=已拒绝 |
| linked_product_id | bigint | 关联商城商品ID |
| cover_url | text | 封面URL |
| download_url | text | 视频/图文直链 |
| source_url | text | 原始作品地址 |
| source_keyword | varchar(255) | 来源关键词 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |
#### 商品表 (products)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键,自增 |
| name | varchar(255) | 商品名称 |
| description | text | 商品描述 |
| price | decimal(10,2) | 价格 |
| original_price | decimal(10,2) | 匟价 |
| image | varchar(500) | 主图 |
| images | json | 商品图片列表 |
| category_id | int | 分类ID |
| product_type_id | int | 商品类型ID |
| brand_id | int | 品牌ID |
| sku | varchar(100) | 商品SKU |
| stock | int | 库存数量 |
| sales_count | int | 销量 |
| heat_score | int | AI选品热度分数(0-100) |
| is_ai_recommended | tinyint(1) | 是否AI推荐 |
| ai_recommendation | text | AI推荐理由 |
| source_platform | varchar(50) | 来源平台 |
| source_url | varchar(500) | 来源链接 |
| download_url | varchar(500) | 下载链接 |
| tags | json | 标签列表 |
| status | tinyint(1) | 状态: 1=上架, 0=下架 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |
#### 采集内容表(source_content_items)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 自增主键 |
| platform | varchar(32) | 平台标识，如 douyin / bilibili |
| platform_content_id | varchar(128) | 平台内容ID |
| content_type | varchar(32) | 内容类型，如 video / image_post |
| title | text | 作品标题 |
| desc | text | 作品描述/文案 |
| publish_time | bigint | 发布时间(秒级时间戳) |
| liked_count | int | 点赞数 |
| comment_count | int | 评论数 |
| share_count | int | 分享数 |
| favorite_count | int | 收藏数 |
| source_url | text | 作品URL |
| cover_url | text | 封面图URL |
| play_url | text | 视频播放直链 |
| source_keyword | varchar(255) | 来源关键词 |
## 十一、运行项目
### 11.1 安装依赖
```bash
# 安装依赖(开发环境)
npm install
# 启动开发服务器
npm run dev
```
### 11.2 启动生产服务器
```bash
# 启动生产服务器
npm start
```
### 11.3 测试数据库连接
```bash
# 测试数据库连接
npm run test-db
```
### 11.4 安装依赖
```bash
# 安装依赖
如果npm install未安装则运行)
npm run install-deps
```

## 十二、贡献指南
- 欢迎基于本项目进行二次开发和功能扩展
- 如需添加新功能,请提交Issue或Pull Request
- 代码改进建议请提交Pull Request
- 文档改进请提交Issue

## 许可证

本项目采用 MIT 许可证,详见 LICENSE 文件。

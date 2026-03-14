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

-- ============================================================
-- 为 agent-mall 数据库所有缺少注释的字段添加注释
-- 生成时间: 2026-05-16
-- ============================================================

SET NAMES utf8mb4;

-- ============================================================
-- 1. admin_roles (后台角色表)
-- ============================================================
ALTER TABLE `admin_roles` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `admin_roles` MODIFY COLUMN `code` varchar(50) NOT NULL COMMENT '角色编码，如 super_admin / admin / operator';
ALTER TABLE `admin_roles` MODIFY COLUMN `name` varchar(50) NOT NULL COMMENT '角色名称';
ALTER TABLE `admin_roles` MODIFY COLUMN `description` varchar(255) DEFAULT NULL COMMENT '角色描述';
ALTER TABLE `admin_roles` MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 1=启用, 0=禁用';
ALTER TABLE `admin_roles` MODIFY COLUMN `is_system` tinyint NOT NULL DEFAULT 0 COMMENT '是否系统内置: 1=系统内置不可删除, 0=自定义角色';
ALTER TABLE `admin_roles` MODIFY COLUMN `permissions` json NOT NULL COMMENT '权限点集合，JSON数组';
ALTER TABLE `admin_roles` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `admin_roles` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 2. admin_users (管理员用户表)
-- ============================================================
ALTER TABLE `admin_users` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 3. ai_product_candidate (AI候选商品表)
-- ============================================================
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `source_content_id` bigint DEFAULT NULL COMMENT '关联 source_content_items.id，指向采集内容';
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `source_platform` varchar(50) DEFAULT NULL COMMENT '来源平台: douyin | bilibili';
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `platform_content_id` varchar(128) DEFAULT NULL COMMENT '平台端内容ID，如抖音 aweme_id、B站 bvid';
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `content_type` varchar(50) DEFAULT 'video' COMMENT '内容类型: video | image | text';
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `ai_product_candidate` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 4. brands (品牌表)
-- ============================================================
ALTER TABLE `brands` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 5. cart_items (购物车明细表)
-- ============================================================
ALTER TABLE `cart_items` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `cart_items` MODIFY COLUMN `cart_id` bigint NOT NULL COMMENT '关联购物车ID (shopping_carts.id)';
ALTER TABLE `cart_items` MODIFY COLUMN `product_id` int NOT NULL COMMENT '关联商品ID (products.id)';
ALTER TABLE `cart_items` MODIFY COLUMN `sku_id` bigint NOT NULL COMMENT '关联SKU ID (product_skus.id)，用户实际购买的规格';
ALTER TABLE `cart_items` MODIFY COLUMN `quantity` int NOT NULL DEFAULT 1 COMMENT '购买数量';
ALTER TABLE `cart_items` MODIFY COLUMN `selected` tinyint NOT NULL DEFAULT 1 COMMENT '是否选中用于结算: 1=选中, 0=未选中';
ALTER TABLE `cart_items` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `cart_items` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 6. categories (商品分类表)
-- ============================================================
ALTER TABLE `categories` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 7. commercial_keywords (商业关键词池)
-- ============================================================
ALTER TABLE `commercial_keywords` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `attempt_count` int NOT NULL DEFAULT 0 COMMENT '被调度尝试次数（含失败）';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `last_attempted_at` datetime DEFAULT NULL COMMENT '最近一次被调度尝试时间';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `last_attempt_status` varchar(20) DEFAULT NULL COMMENT '最近一次调度结果: running | success | failed';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `last_collected_platform` varchar(50) DEFAULT NULL COMMENT '最近一次采集的平台';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `valid_until` datetime DEFAULT NULL COMMENT '有效期截止时间';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `commercial_keywords` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 8. crawler_collection_runs (采集任务运行日志表)
-- ============================================================
ALTER TABLE `crawler_collection_runs` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 9. keyword_analysis_results (热点关键词分析结果表)
-- ============================================================
ALTER TABLE `keyword_analysis_results` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `keyword_analysis_results` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';

-- ============================================================
-- 10. order_items (订单明细表)
-- ============================================================
ALTER TABLE `order_items` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `order_items` MODIFY COLUMN `order_id` bigint NOT NULL COMMENT '关联订单ID (orders.id)';
ALTER TABLE `order_items` MODIFY COLUMN `product_id` int DEFAULT NULL COMMENT '关联商品ID (products.id)';
ALTER TABLE `order_items` MODIFY COLUMN `sku_id` bigint DEFAULT NULL COMMENT '关联SKU ID (product_skus.id)，订单快照保存';
ALTER TABLE `order_items` MODIFY COLUMN `sku_code` varchar(100) DEFAULT NULL COMMENT 'SKU编码快照，避免后续SKU变更影响历史订单';
ALTER TABLE `order_items` MODIFY COLUMN `sku_name` varchar(255) DEFAULT NULL COMMENT 'SKU名称快照';
ALTER TABLE `order_items` MODIFY COLUMN `spec_summary` json DEFAULT NULL COMMENT '规格组合快照，JSON格式存储规格键值对';
ALTER TABLE `order_items` MODIFY COLUMN `product_name` varchar(255) NOT NULL COMMENT '商品名称快照';
ALTER TABLE `order_items` MODIFY COLUMN `product_image` varchar(500) DEFAULT NULL COMMENT '商品图片快照';
ALTER TABLE `order_items` MODIFY COLUMN `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '下单时单价';
ALTER TABLE `order_items` MODIFY COLUMN `quantity` int NOT NULL DEFAULT 1 COMMENT '购买数量';
ALTER TABLE `order_items` MODIFY COLUMN `line_total` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '行小计金额 (单价 x 数量)';
ALTER TABLE `order_items` MODIFY COLUMN `source_platform` varchar(50) DEFAULT NULL COMMENT '商品来源平台: douyin | bilibili 等';
ALTER TABLE `order_items` MODIFY COLUMN `source_url` varchar(500) DEFAULT NULL COMMENT '商品来源链接';
ALTER TABLE `order_items` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `order_items` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 11. orders (订单主表)
-- ============================================================
ALTER TABLE `orders` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `orders` MODIFY COLUMN `order_no` varchar(40) NOT NULL COMMENT '订单编号，唯一标识';
ALTER TABLE `orders` MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '前台用户ID (users.id)';
ALTER TABLE `orders` MODIFY COLUMN `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额';
ALTER TABLE `orders` MODIFY COLUMN `payable_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额（可能含折扣/运费调整）';
ALTER TABLE `orders` MODIFY COLUMN `status` enum('pending_payment','paid','shipped','completed','cancelled','refunding','refunded') NOT NULL DEFAULT 'pending_payment' COMMENT '订单状态: pending_payment=待付款, paid=已付款, shipped=已发货, completed=已完成, cancelled=已取消, refunding=退款中, refunded=已退款';
ALTER TABLE `orders` MODIFY COLUMN `payment_status` enum('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid' COMMENT '支付状态: unpaid=未支付, paid=已支付, refunded=已退款';
ALTER TABLE `orders` MODIFY COLUMN `consignee_name` varchar(50) NOT NULL COMMENT '收货人姓名';
ALTER TABLE `orders` MODIFY COLUMN `consignee_phone` varchar(20) NOT NULL COMMENT '收货人电话';
ALTER TABLE `orders` MODIFY COLUMN `shipping_address` text NOT NULL COMMENT '收货地址（省市区+详细地址拼接）';
ALTER TABLE `orders` MODIFY COLUMN `remark` varchar(255) DEFAULT NULL COMMENT '订单备注';
ALTER TABLE `orders` MODIFY COLUMN `paid_at` datetime DEFAULT NULL COMMENT '支付时间';
ALTER TABLE `orders` MODIFY COLUMN `shipped_at` datetime DEFAULT NULL COMMENT '发货时间';
ALTER TABLE `orders` MODIFY COLUMN `completed_at` datetime DEFAULT NULL COMMENT '完成时间（确认收货或系统自动完成）';
ALTER TABLE `orders` MODIFY COLUMN `cancelled_at` datetime DEFAULT NULL COMMENT '取消时间';
ALTER TABLE `orders` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `orders` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 12. product_attribute_values (商品属性值表)
-- ============================================================
ALTER TABLE `product_attribute_values` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 13. product_attributes (商品属性表 / 规格项表)
-- ============================================================
ALTER TABLE `product_attributes` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 14. product_sku_specs (SKU规格映射表)
-- ============================================================
ALTER TABLE `product_sku_specs` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `product_sku_specs` MODIFY COLUMN `sku_id` bigint NOT NULL COMMENT '关联SKU ID (product_skus.id)';
ALTER TABLE `product_sku_specs` MODIFY COLUMN `attribute_id` int NOT NULL COMMENT '关联规格项ID (product_attributes.id)';
ALTER TABLE `product_sku_specs` MODIFY COLUMN `attribute_value_id` int DEFAULT NULL COMMENT '关联规格值ID (product_attribute_values.id)，自定义值时可为空';
ALTER TABLE `product_sku_specs` MODIFY COLUMN `custom_value` varchar(255) DEFAULT NULL COMMENT '自定义规格值文本，当未选择预设规格值时使用';
ALTER TABLE `product_sku_specs` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `product_sku_specs` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 15. product_skus (商品SKU表)
-- ============================================================
ALTER TABLE `product_skus` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `product_skus` MODIFY COLUMN `product_id` int NOT NULL COMMENT '关联商品ID (products.id)';
ALTER TABLE `product_skus` MODIFY COLUMN `sku_code` varchar(100) NOT NULL COMMENT 'SKU编码，同一商品下唯一';
ALTER TABLE `product_skus` MODIFY COLUMN `sku_name` varchar(255) NOT NULL COMMENT 'SKU名称（通常为规格组合描述，如"红色 / M码"）';
ALTER TABLE `product_skus` MODIFY COLUMN `price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'SKU售价';
ALTER TABLE `product_skus` MODIFY COLUMN `original_price` decimal(10,2) DEFAULT NULL COMMENT 'SKU原价 / 划线价';
ALTER TABLE `product_skus` MODIFY COLUMN `stock` int NOT NULL DEFAULT 0 COMMENT 'SKU库存数量';
ALTER TABLE `product_skus` MODIFY COLUMN `image` varchar(500) DEFAULT NULL COMMENT 'SKU图片（规格图），为空时使用商品主图';
ALTER TABLE `product_skus` MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 1=启用, 0=禁用';
ALTER TABLE `product_skus` MODIFY COLUMN `is_default` tinyint NOT NULL DEFAULT 0 COMMENT '是否默认SKU: 1=是, 0=否';
ALTER TABLE `product_skus` MODIFY COLUMN `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序，数值越小越靠前';
ALTER TABLE `product_skus` MODIFY COLUMN `spec_summary` json DEFAULT NULL COMMENT '规格摘要，JSON数组存储当前SKU的规格组合';
ALTER TABLE `product_skus` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `product_skus` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 16. product_types (商品类型表 / 规格模板表)
-- ============================================================
ALTER TABLE `product_types` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 17. products (商品表)
-- ============================================================
ALTER TABLE `products` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 18. return_requests (退货申请表)
-- ============================================================
ALTER TABLE `return_requests` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `return_requests` MODIFY COLUMN `order_id` bigint NOT NULL COMMENT '关联订单ID (orders.id)';
ALTER TABLE `return_requests` MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '申请人用户ID (users.id)';
ALTER TABLE `return_requests` MODIFY COLUMN `order_no` varchar(40) NOT NULL COMMENT '关联订单编号';
ALTER TABLE `return_requests` MODIFY COLUMN `order_status_before` varchar(50) NOT NULL COMMENT '申请退货时的订单状态快照';
ALTER TABLE `return_requests` MODIFY COLUMN `reason` varchar(255) NOT NULL COMMENT '退货原因';
ALTER TABLE `return_requests` MODIFY COLUMN `description` text DEFAULT NULL COMMENT '退货详细说明';
ALTER TABLE `return_requests` MODIFY COLUMN `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending' COMMENT '处理状态: pending=待处理, approved=已通过, rejected=已拒绝';
ALTER TABLE `return_requests` MODIFY COLUMN `admin_remark` text DEFAULT NULL COMMENT '管理员处理备注';
ALTER TABLE `return_requests` MODIFY COLUMN `processed_at` datetime DEFAULT NULL COMMENT '处理时间';
ALTER TABLE `return_requests` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `return_requests` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 19. shopping_carts (购物车主表)
-- ============================================================
ALTER TABLE `shopping_carts` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `shopping_carts` MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '前台用户ID (users.id)，一个用户只有一个购物车';
ALTER TABLE `shopping_carts` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `shopping_carts` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 20. source_content_items (采集到的平台内容表)
-- ============================================================
ALTER TABLE `source_content_items` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 21. system_configs (系统配置表)
-- ============================================================
ALTER TABLE `system_configs` MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT COMMENT '主键ID';

-- ============================================================
-- 22. trending_keywords (原始热点关键词表)
-- ============================================================
ALTER TABLE `trending_keywords` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `trending_keywords` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `trending_keywords` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 23. user_addresses (用户收货地址表)
-- ============================================================
ALTER TABLE `user_addresses` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `user_addresses` MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '前台用户ID (users.id)';
ALTER TABLE `user_addresses` MODIFY COLUMN `recipient_name` varchar(50) NOT NULL COMMENT '收件人姓名';
ALTER TABLE `user_addresses` MODIFY COLUMN `recipient_phone` varchar(20) NOT NULL COMMENT '收件人电话';
ALTER TABLE `user_addresses` MODIFY COLUMN `province` varchar(50) NOT NULL COMMENT '省份';
ALTER TABLE `user_addresses` MODIFY COLUMN `city` varchar(50) NOT NULL COMMENT '城市';
ALTER TABLE `user_addresses` MODIFY COLUMN `district` varchar(50) DEFAULT NULL COMMENT '区/县';
ALTER TABLE `user_addresses` MODIFY COLUMN `detail_address` varchar(255) NOT NULL COMMENT '详细地址（街道、门牌号等）';
ALTER TABLE `user_addresses` MODIFY COLUMN `postal_code` varchar(20) DEFAULT NULL COMMENT '邮政编码';
ALTER TABLE `user_addresses` MODIFY COLUMN `is_default` tinyint NOT NULL DEFAULT 0 COMMENT '是否默认地址: 1=默认, 0=非默认';
ALTER TABLE `user_addresses` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `user_addresses` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 24. users (商城前台用户表)
-- ============================================================
ALTER TABLE `users` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID';
ALTER TABLE `users` MODIFY COLUMN `username` varchar(50) NOT NULL COMMENT '用户名（登录账号）';
ALTER TABLE `users` MODIFY COLUMN `nickname` varchar(50) DEFAULT NULL COMMENT '昵称（展示用）';
ALTER TABLE `users` MODIFY COLUMN `phone` varchar(20) DEFAULT NULL COMMENT '手机号';
ALTER TABLE `users` MODIFY COLUMN `email` varchar(100) DEFAULT NULL COMMENT '邮箱';
ALTER TABLE `users` MODIFY COLUMN `password` varchar(255) NOT NULL COMMENT '密码（bcrypt加密）';
ALTER TABLE `users` MODIFY COLUMN `avatar` varchar(255) DEFAULT NULL COMMENT '头像URL';
ALTER TABLE `users` MODIFY COLUMN `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间';
ALTER TABLE `users` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';
ALTER TABLE `users` MODIFY COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间';

-- ============================================================
-- 脚本执行完成
-- ============================================================

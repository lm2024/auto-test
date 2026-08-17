-- ================================================================
-- 02_seed_data.sql · 演示数据（DML）
-- 说明：电商场景演示数据，覆盖所有菜单，便于理解系统用法。
--       依赖 01_schema.sql 已先执行；手动执行前请确保库已存在。
-- 手动执行：mysql -uroot -p auto_test < 02_seed_data.sql
-- ================================================================
USE auto_test;

-- ================================================================
-- 演示数据（电商场景，覆盖所有菜单，便于理解系统用法）
-- 说明：账号密码使用 AES-ECB 加密（密钥 account.aes-key），
--       管理员/普通用户密码均为 Admin@123（BCrypt）
-- ================================================================

-- -------------------------------------------
-- 分类字典（系统分类 system / 功能分类 func）
-- -------------------------------------------
INSERT INTO `dict_category` (`id`, `category_type`, `category_code`, `category_name`, `sort_order`, `status`, `create_time`) VALUES
(11, 'system', 'user_mgmt', '用户管理', 1, 1, '2026-08-01 10:00:00'),
(12, 'system', 'order_system', '订单系统', 2, 1, '2026-08-01 10:00:00'),
(13, 'system', 'payment_system', '支付系统', 3, 1, '2026-08-01 10:00:00'),
(14, 'system', 'approval_flow', '审批流程', 4, 1, '2026-08-01 10:00:00'),
(15, 'system', 'data_query', '数据查询', 5, 1, '2026-08-01 10:00:00'),
(16, 'func', 'login_auth', '登录认证', 1, 1, '2026-08-01 10:00:00'),
(17, 'func', 'data_query', '数据查询', 2, 1, '2026-08-01 10:00:00'),
(18, 'func', 'data_create', '数据新增', 3, 1, '2026-08-01 10:00:00'),
(19, 'func', 'data_update', '数据修改', 4, 1, '2026-08-01 10:00:00'),
(20, 'func', 'data_delete', '数据删除', 5, 1, '2026-08-01 10:00:00');

-- -------------------------------------------
-- 租户
-- -------------------------------------------
INSERT INTO `sys_tenant` (`id`, `tenant_code`, `tenant_name`, `status`, `create_time`, `update_time`) VALUES
(1, 'default', '默认租户', 1, '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
(2, 'huadong', '华东事业部', 1, '2026-08-02 10:00:00', '2026-08-02 10:00:00'),
(3, 'huanan', '华南事业部', 1, '2026-08-03 10:00:00', '2026-08-03 10:00:00');

-- -------------------------------------------
-- 产品
-- -------------------------------------------
INSERT INTO `sys_product` (`id`, `product_code`, `product_name`, `tenant_id`, `description`, `status`, `create_by`, `create_time`, `update_time`) VALUES
(1, 'mall', '电商商城', 1, 'B2C 电商平台，覆盖商品、订单、支付全流程', 1, 'admin', '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
(2, 'paygw', '支付网关', 1, '统一支付接入、渠道路由与对账', 1, 'admin', '2026-08-02 09:00:00', '2026-08-02 09:00:00'),
(3, 'crm', '客户管理系统', 1, '销售线索与客户跟进管理', 1, 'admin', '2026-08-03 09:00:00', '2026-08-03 09:00:00');

-- -------------------------------------------
-- 系统注册表（内外网识别 + 调用关系图数据源）
-- -------------------------------------------
INSERT INTO `sys_system_registry` (`id`, `system_code`, `system_name`, `scope`, `domain_patterns`, `ip_ranges`, `category`, `owner`, `description`, `sort_order`, `status`, `tenant_id`, `create_time`, `update_time`) VALUES
(1, 'ORDER_SERVICE', '订单中心', 'INTERNAL', '*.order.internal.example.com', '10.0.10.0/24', '电商核心', '张伟', '订单创建、查询、状态流转', 1, 1, 1, '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
(2, 'USER_SERVICE', '用户中心', 'INTERNAL', '*.user.internal.example.com', '10.0.20.0/24', '电商核心', '李娜', '用户注册、登录、会员信息', 2, 1, 1, '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
(3, 'GOODS_SERVICE', '商品中心', 'INTERNAL', '*.goods.internal.example.com', '10.0.30.0/24', '电商核心', '王强', '商品、库存、价格管理', 3, 1, 1, '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
(4, 'PAYMENT_GATEWAY', '支付网关', 'EXTERNAL', 'pay.example.com, *.pay.example.com', NULL, '电商核心', '赵敏', '第三方支付渠道接入与回调', 4, 1, 1, '2026-08-01 09:00:00', '2026-08-01 09:00:00'),
(5, 'CRM_SYSTEM', '客户管理', 'EXTERNAL', 'crm.example.com', NULL, '业务系统', '陈杰', '销售线索与客户跟进', 5, 1, 1, '2026-08-01 09:00:00', '2026-08-01 09:00:00');

-- -------------------------------------------
-- 树形分类（用于链路的树形归档与筛选）
-- -------------------------------------------
INSERT INTO `sys_category` (`id`, `parent_id`, `category_name`, `sort_order`, `icon`, `tenant_id`, `status`, `create_time`, `update_time`) VALUES
(1, 0, '电商核心', 1, 'cart', 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(2, 0, '用户与账号', 2, 'user', 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(11, 1, '下单流程', 1, NULL, 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(12, 1, '支付流程', 2, NULL, 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(13, 1, '退款流程', 3, NULL, 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(21, 2, '登录注册', 1, NULL, 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00');

-- -------------------------------------------
-- 全局变量（跨链路复用，${var_key} 引用）
-- -------------------------------------------
INSERT INTO `test_global_variable` (`id`, `var_key`, `var_value`, `var_type`, `scope`, `chain_code`, `is_secret`, `description`, `status`, `tenant_id`, `create_time`, `update_time`) VALUES
(1, 'BASE_URL', 'https://mall.example.com', 'STRING', 'GLOBAL', NULL, 0, '电商主域名', 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(2, 'ORDER_API_TOKEN', 'demo-token-order-2026', 'STRING', 'GLOBAL', NULL, 1, '订单接口访问令牌（敏感）', 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(3, 'PAY_CALLBACK_SECRET', 'demo-callback-secret', 'STRING', 'GLOBAL', NULL, 1, '支付回调验签密钥（敏感）', 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(4, 'DEFAULT_PAGE_SIZE', '20', 'NUMBER', 'GLOBAL', NULL, 0, '默认分页大小', 1, 1, '2026-08-01 10:00:00', '2026-08-01 10:00:00');

-- -------------------------------------------
-- 系统配置
-- -------------------------------------------
INSERT INTO `sys_config` (`id`, `config_key`, `config_value`, `config_desc`, `create_time`, `update_time`) VALUES
(1, 'ai.base-url', 'http://localhost:11434/v1', 'AI 服务地址', '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(2, 'ai.model', 'qwen-max', 'AI 模型名称', '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(3, 'exec.timeout-seconds', '120', '链路执行超时时间(秒)', '2026-08-01 10:00:00', '2026-08-01 10:00:00'),
(4, 'captcha.bypass', 'true', '验证码绕过开关（仅测试环境）', '2026-08-01 10:00:00', '2026-08-01 10:00:00');

-- -------------------------------------------
-- 测试账号（密码为 AES 密文，明文见备注）
-- -------------------------------------------
INSERT INTO `test_account` (`id`, `account_code`, `account_name`, `tenant_id`, `product_code`, `system_name`, `username`, `password`, `auth_type`, `auth_config`, `login_type`, `login_config`, `login_script`, `status`, `last_used_time`, `lock_until`, `valid_from`, `valid_until`, `create_time`, `update_time`) VALUES
(1, 'ACC_ORDER_ADMIN', '订单中心-管理员', 1, 'mall', '订单中心', 'order_admin', 'QiHCYBnIEjJwhCyISkIAXA==', 'PASSWORD', NULL, 'HTTP', '{"loginUrl":"https://mall.example.com/api/login","tokenField":"data.token"}', NULL, 1, '2026-08-13 09:30:00', NULL, '2026-08-01 00:00:00', '2026-12-31 23:59:59', '2026-08-01 10:00:00', '2026-08-13 09:30:00'),
(2, 'ACC_PAY_TEST', '支付网关-测试', 1, 'paygw', '支付网关', 'pay_tester', '9qpPpamw7oHL+I+0rsQpqQ==', 'PASSWORD', NULL, 'HTTP', '{"loginUrl":"https://pay.example.com/api/login"}', NULL, 1, '2026-08-13 14:20:00', NULL, NULL, NULL, '2026-08-02 10:00:00', '2026-08-13 14:20:00'),
(3, 'ACC_USER_TEST', '用户中心-测试', 1, 'mall', '用户中心', 'user_tester', 'S9p4v7UkTNiZC5UWCzIi3g==', 'PASSWORD', NULL, 'HTTP', '{"loginUrl":"https://mall.example.com/api/login"}', NULL, 1, '2026-08-12 10:00:00', NULL, NULL, NULL, '2026-08-02 10:00:00', '2026-08-12 10:00:00'),
(4, 'ACC_GOODS_TEST', '商品中心-测试', 1, 'mall', '商品中心', 'goods_tester', 'WMtAznDCi5mZPY64a5rE3g==', 'PASSWORD', NULL, 'HTTP', '{"loginUrl":"https://mall.example.com/api/login"}', NULL, 1, NULL, NULL, NULL, NULL, '2026-08-03 10:00:00', '2026-08-03 10:00:00'),
(5, 'ACC_CRM_TEST', 'CRM-测试', 1, 'crm', '客户管理', 'crm_tester', 'mn81SUlVi+lDBVMaA8//Nw==', 'PASSWORD', NULL, 'HTTP', '{"loginUrl":"https://crm.example.com/api/login"}', NULL, 0, NULL, NULL, NULL, NULL, '2026-08-03 10:00:00', '2026-08-03 10:00:00');

-- -------------------------------------------
-- 测试账号使用记录
-- -------------------------------------------
INSERT INTO `test_account_usage` (`id`, `account_id`, `account_code`, `tenant_id`, `user_id`, `operator_name`, `execution_id`, `task_id`, `chain_code`, `data_pool_code`, `usage_type`, `status`, `started_at`, `ended_at`, `duration_ms`, `release_reason`) VALUES
(1, 1, 'ACC_ORDER_ADMIN', 1, 1, 'admin', 'EXEC_2026081301', NULL, 'CHAIN_MALL_ORDER', 'POOL_ORDER', 'EXECUTION', 'RELEASED', '2026-08-13 09:30:00', '2026-08-13 09:30:12', 12000, '执行完成自动释放'),
(2, 3, 'ACC_USER_TEST', 1, 1, 'admin', 'EXEC_2026081302', NULL, 'CHAIN_MALL_LOGIN', NULL, 'EXECUTION', 'RELEASED', '2026-08-13 09:45:00', '2026-08-13 09:45:08', 8000, '执行完成自动释放'),
(3, 2, 'ACC_PAY_TEST', 1, 1, 'admin', 'EXEC_2026081401', NULL, 'CHAIN_REFUND', NULL, 'EXECUTION', 'RELEASED', '2026-08-14 08:00:00', '2026-08-14 08:00:15', 15000, '执行完成自动释放');

-- -------------------------------------------
-- 测试链路
-- -------------------------------------------
INSERT INTO `test_chain` (`id`, `chain_code`, `chain_name`, `execute_mode`, `description`, `create_time`, `update_time`, `create_by`, `status`, `graph_data`, `biz_oper_trace_id`, `account_code`, `system_category`, `func_category`, `priority`, `category_id`, `tenant_id`, `product_code`, `login_chain_code`, `login_timeout`, `data_pool_code`, `param_mode`) VALUES
(1, 'CHAIN_MALL_ORDER', '电商下单主链路', 1, '登录→浏览商品→创建订单→支付，电商核心回归链路', '2026-08-05 10:00:00', '2026-08-13 09:30:00', 'admin', 1, NULL, NULL, 'ACC_ORDER_ADMIN', 'order_system', 'data_create', 0, 11, 1, 'mall', NULL, 30000, 'POOL_ORDER', 'DYNAMIC'),
(2, 'CHAIN_MALL_LOGIN', '用户登录链路', 1, '账号密码登录并获取访问令牌', '2026-08-05 11:00:00', '2026-08-13 09:45:00', 'admin', 1, NULL, NULL, 'ACC_USER_TEST', 'user_mgmt', 'login_auth', 0, 21, 1, 'mall', NULL, 30000, NULL, 'NONE'),
(3, 'CHAIN_ORDER_QUERY', '订单查询链路', 1, '按条件分页查询订单列表并校验关键字段', '2026-08-06 10:00:00', '2026-08-13 10:00:00', 'admin', 1, NULL, NULL, 'ACC_ORDER_ADMIN', 'order_system', 'data_query', 1, 11, 1, 'mall', NULL, 30000, NULL, 'NONE'),
(4, 'CHAIN_REFUND', '退款流程链路', 2, '发起退款→风控审核→退款回调，分组并行', '2026-08-07 10:00:00', '2026-08-14 08:00:00', 'admin', 1, NULL, NULL, 'ACC_ORDER_ADMIN', 'payment_system', 'data_update', 1, 13, 1, 'mall', NULL, 30000, NULL, 'NONE'),
(5, 'CHAIN_GOODS_PUBLISH', '商品上架链路', 1, '创建商品→库存校验→上架', '2026-08-08 10:00:00', '2026-08-12 16:00:00', 'admin', 1, NULL, NULL, 'ACC_GOODS_TEST', 'order_system', 'data_create', 2, 11, 1, 'mall', NULL, 30000, NULL, 'NONE');

-- -------------------------------------------
-- 节点配置（每条链路下的接口节点）
-- -------------------------------------------
INSERT INTO `test_node_config` (`id`, `chain_code`, `node_id`, `node_code`, `node_name`, `node_type`, `interface_scope`, `target_system`, `request_url`, `request_method`, `request_headers`, `body_type`, `body_data`, `extract_rules`, `assert_rules`, `variable_mapping`, `delay_seconds`, `biz_oper_trace_id`, `trigger_event`, `target_dom`, `page_url`, `window_id`, `is_ignored`, `create_time`, `update_time`) VALUES
(1, 'CHAIN_MALL_ORDER', 1, 'NODE_MALL_ORDER_01', '登录获取令牌', 'HTTP', 'INTERNAL', 'USER_SERVICE', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"username":"order_admin","password":"Order@2026"}', '{"rules":[{"varName":"token","jsonPath":"$.data.token"}]}', '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 10:00:00', '2026-08-05 10:00:00'),
(2, 'CHAIN_MALL_ORDER', 2, 'NODE_MALL_ORDER_02', '查询商品列表', 'HTTP', 'INTERNAL', 'GOODS_SERVICE', 'https://mall.example.com/api/goods/list?pageNo=1&pageSize=10', 'GET', '{"Authorization":"Bearer ${token}"}', NULL, NULL, NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 10:00:00', '2026-08-05 10:00:00'),
(3, 'CHAIN_MALL_ORDER', 3, 'NODE_MALL_ORDER_03', '创建订单', 'HTTP', 'INTERNAL', 'ORDER_SERVICE', 'https://mall.example.com/api/order/create', 'POST', '{"Content-Type":"application/json","Authorization":"Bearer ${token}"}', 'JSON', '{"productId":"P001","amount":199,"address":"上海市浦东新区"}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 10:00:00', '2026-08-05 10:00:00'),
(4, 'CHAIN_MALL_ORDER', 4, 'NODE_MALL_ORDER_04', '发起支付', 'HTTP', 'EXTERNAL', 'PAYMENT_GATEWAY', 'https://pay.example.com/api/pay/create', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"orderId":"${orderId}","amount":199}', '{"rules":[{"varName":"payUrl","jsonPath":"$.data.payUrl"}]}', '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 10:00:00', '2026-08-05 10:00:00'),
(5, 'CHAIN_MALL_ORDER', 5, 'NODE_MALL_ORDER_05', '查询订单状态', 'HTTP', 'INTERNAL', 'ORDER_SERVICE', 'https://mall.example.com/api/order/detail?orderId=${orderId}', 'GET', '{"Authorization":"Bearer ${token}"}', NULL, NULL, NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 10:00:00', '2026-08-05 10:00:00'),
(6, 'CHAIN_MALL_LOGIN', 1, 'NODE_MALL_LOGIN_01', '账号密码登录', 'HTTP', 'INTERNAL', 'USER_SERVICE', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"username":"user_tester","password":"User@2026"}', '{"rules":[{"varName":"token","jsonPath":"$.data.token"}]}', '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 11:00:00', '2026-08-05 11:00:00'),
(7, 'CHAIN_MALL_LOGIN', 2, 'NODE_MALL_LOGIN_02', '获取用户信息', 'HTTP', 'INTERNAL', 'USER_SERVICE', 'https://mall.example.com/api/user/profile', 'GET', '{"Authorization":"Bearer ${token}"}', NULL, NULL, NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 11:00:00', '2026-08-05 11:00:00'),
(8, 'CHAIN_MALL_LOGIN', 3, 'NODE_MALL_LOGIN_03', '校验令牌有效性', 'HTTP', 'INTERNAL', 'USER_SERVICE', 'https://mall.example.com/api/auth/check', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"token":"${token}"}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-05 11:00:00', '2026-08-05 11:00:00'),
(9, 'CHAIN_ORDER_QUERY', 1, 'NODE_ORDER_QUERY_01', '登录获取令牌', 'HTTP', 'INTERNAL', 'USER_SERVICE', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"username":"order_admin","password":"Order@2026"}', '{"rules":[{"varName":"token","jsonPath":"$.data.token"}]}', '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-06 10:00:00', '2026-08-06 10:00:00'),
(10, 'CHAIN_ORDER_QUERY', 2, 'NODE_ORDER_QUERY_02', '分页查询订单', 'HTTP', 'INTERNAL', 'ORDER_SERVICE', 'https://mall.example.com/api/order/list?pageNo=1&pageSize=20&status=PAID', 'GET', '{"Authorization":"Bearer ${token}"}', NULL, NULL, NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-06 10:00:00', '2026-08-06 10:00:00'),
(11, 'CHAIN_REFUND', 1, 'NODE_REFUND_01', '发起退款', 'HTTP', 'INTERNAL', 'ORDER_SERVICE', 'https://mall.example.com/api/refund/apply', 'POST', '{"Content-Type":"application/json","Authorization":"Bearer ${token}"}', 'JSON', '{"orderId":"${orderId}","reason":"用户申请退款"}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-07 10:00:00', '2026-08-07 10:00:00'),
(12, 'CHAIN_REFUND', 2, 'NODE_REFUND_02', '风控审核', 'HTTP', 'INTERNAL', 'ORDER_SERVICE', 'https://mall.example.com/api/refund/audit', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"refundId":"${refundId}","result":"PASS"}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-07 10:00:00', '2026-08-07 10:00:00'),
(13, 'CHAIN_REFUND', 3, 'NODE_REFUND_03', '退款回调', 'HTTP', 'EXTERNAL', 'PAYMENT_GATEWAY', 'https://pay.example.com/api/refund/callback', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"refundId":"${refundId}","status":"SUCCESS"}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-07 10:00:00', '2026-08-07 10:00:00'),
(14, 'CHAIN_GOODS_PUBLISH', 1, 'NODE_GOODS_PUBLISH_01', '登录获取令牌', 'HTTP', 'INTERNAL', 'USER_SERVICE', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"username":"goods_tester","password":"Goods@2026"}', '{"rules":[{"varName":"token","jsonPath":"$.data.token"}]}', '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-08 10:00:00', '2026-08-08 10:00:00'),
(15, 'CHAIN_GOODS_PUBLISH', 2, 'NODE_GOODS_PUBLISH_02', '创建商品', 'HTTP', 'INTERNAL', 'GOODS_SERVICE', 'https://mall.example.com/api/goods/create', 'POST', '{"Content-Type":"application/json","Authorization":"Bearer ${token}"}', 'JSON', '{"name":"测试商品","price":199,"stock":100}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-08 10:00:00', '2026-08-08 10:00:00'),
(16, 'CHAIN_GOODS_PUBLISH', 3, 'NODE_GOODS_PUBLISH_03', '商品上架', 'HTTP', 'INTERNAL', 'GOODS_SERVICE', 'https://mall.example.com/api/goods/publish', 'POST', '{"Content-Type":"application/json"}', 'JSON', '{"goodsId":"${goodsId}","action":"ON_SHELF"}', NULL, '{"statusCode":200,"body":{"$.code":0}}', NULL, 0, NULL, NULL, NULL, NULL, NULL, 0, '2026-08-08 10:00:00', '2026-08-08 10:00:00');

-- -------------------------------------------
-- 数据池（参数化测试数据源）
-- -------------------------------------------
INSERT INTO `test_data_pool` (`id`, `pool_code`, `pool_name`, `tenant_id`, `product_code`, `description`, `column_defs`, `status`, `create_by`, `create_time`, `update_time`) VALUES
(1, 'POOL_ORDER', '订单测试数据', 1, 'mall', '下单链路参数化数据：不同商品与收货地址组合', '[{"name":"orderId","type":"STRING","label":"订单号","required":true},{"name":"userId","type":"STRING","label":"用户ID","required":true},{"name":"productId","type":"STRING","label":"商品ID","required":true},{"name":"amount","type":"NUMBER","label":"金额","required":true}]', 1, 'admin', '2026-08-05 10:00:00', '2026-08-05 10:00:00'),
(2, 'POOL_USER', '用户测试数据', 1, 'mall', '登录链路参数化数据', '[{"name":"username","type":"STRING","label":"用户名","required":true},{"name":"password","type":"STRING","label":"密码","required":true}]', 1, 'admin', '2026-08-05 10:00:00', '2026-08-05 10:00:00');

INSERT INTO `test_data_pool_row` (`id`, `pool_id`, `row_index`, `row_data`, `create_time`) VALUES
(1, 1, 0, '{"orderId":"ORD20260801001","userId":"U1001","productId":"P001","amount":199.00}', '2026-08-05 10:00:00'),
(2, 1, 1, '{"orderId":"ORD20260801002","userId":"U1002","productId":"P002","amount":899.00}', '2026-08-05 10:00:00'),
(3, 1, 2, '{"orderId":"ORD20260801003","userId":"U1003","productId":"P003","amount":59.90}', '2026-08-05 10:00:00'),
(4, 2, 0, '{"username":"user_tester","password":"User@2026"}', '2026-08-05 10:00:00'),
(5, 2, 1, '{"username":"order_admin","password":"Order@2026"}', '2026-08-05 10:00:00');

-- -------------------------------------------
-- 执行记录
-- -------------------------------------------
INSERT INTO `test_execute_main` (`id`, `execution_id`, `chain_code`, `round_number`, `task_id`, `status`, `start_time`, `end_time`, `total_cost_ms`, `error_message`, `node_count`, `success_count`, `fail_count`, `skip_count`, `tenant_id`, `create_time`, `update_time`) VALUES
(1, 'EXEC_2026081301', 'CHAIN_MALL_ORDER', 1, NULL, 'SUCCESS', '2026-08-13 09:30:00', '2026-08-13 09:30:12', 12000, NULL, 5, 5, 0, 0, 1, '2026-08-13 09:30:00', '2026-08-13 09:30:12'),
(2, 'EXEC_2026081302', 'CHAIN_MALL_LOGIN', 1, NULL, 'SUCCESS', '2026-08-13 09:45:00', '2026-08-13 09:45:08', 8000, NULL, 3, 3, 0, 0, 1, '2026-08-13 09:45:00', '2026-08-13 09:45:08'),
(3, 'EXEC_2026081303', 'CHAIN_ORDER_QUERY', 1, NULL, 'SUCCESS', '2026-08-13 10:00:00', '2026-08-13 10:00:06', 6000, NULL, 2, 2, 0, 0, 1, '2026-08-13 10:00:00', '2026-08-13 10:00:06'),
(4, 'EXEC_2026081401', 'CHAIN_REFUND', 1, NULL, 'FAILED', '2026-08-14 08:00:00', '2026-08-14 08:00:15', 15000, '断言失败: 节点[退款回调] 响应码=500', 3, 2, 1, 0, 1, '2026-08-14 08:00:00', '2026-08-14 08:00:15'),
(5, 'EXEC_2026081402', 'CHAIN_GOODS_PUBLISH', 1, NULL, 'SUCCESS', '2026-08-14 08:30:00', '2026-08-14 08:30:09', 9000, NULL, 3, 3, 0, 0, 1, '2026-08-14 08:30:00', '2026-08-14 08:30:09');

-- -------------------------------------------
-- 节点执行明细（配合执行记录）
-- -------------------------------------------
INSERT INTO `test_node_execute_log` (`id`, `execution_id`, `node_code`, `node_name`, `status`, `request_url`, `request_method`, `request_headers`, `request_body`, `response_code`, `response_headers`, `response_body`, `cost_ms`, `error_message`, `extracted_vars`, `start_time`, `end_time`, `create_time`, `biz_oper_trace_id`, `sort_no`) VALUES
(1, 'EXEC_2026081301', 'NODE_MALL_ORDER_01', '登录获取令牌', 'SUCCESS', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', '{"username":"order_admin","password":"***"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"token":"mock-token-1"}}', 2100, NULL, '{"token":"mock-token-1"}', '2026-08-13 09:30:00', '2026-08-13 09:30:02', '2026-08-13 09:30:00', NULL, 1),
(2, 'EXEC_2026081301', 'NODE_MALL_ORDER_02', '查询商品列表', 'SUCCESS', 'https://mall.example.com/api/goods/list?pageNo=1&pageSize=10', 'GET', '{"Authorization":"Bearer mock-token-1"}', NULL, 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"total":3}}', 1800, NULL, NULL, '2026-08-13 09:30:03', '2026-08-13 09:30:05', '2026-08-13 09:30:03', NULL, 2),
(3, 'EXEC_2026081301', 'NODE_MALL_ORDER_03', '创建订单', 'SUCCESS', 'https://mall.example.com/api/order/create', 'POST', '{"Content-Type":"application/json"}', '{"productId":"P001","amount":199}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"orderId":"ORD20260801001"}}', 3200, NULL, '{"orderId":"ORD20260801001"}', '2026-08-13 09:30:05', '2026-08-13 09:30:08', '2026-08-13 09:30:05', NULL, 3),
(4, 'EXEC_2026081301', 'NODE_MALL_ORDER_04', '发起支付', 'SUCCESS', 'https://pay.example.com/api/pay/create', 'POST', '{"Content-Type":"application/json"}', '{"orderId":"ORD20260801001","amount":199}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"payUrl":"https://pay.example.com/pay/xxx"}}', 2800, NULL, '{"payUrl":"https://pay.example.com/pay/xxx"}', '2026-08-13 09:30:08', '2026-08-13 09:30:11', '2026-08-13 09:30:08', NULL, 4),
(5, 'EXEC_2026081301', 'NODE_MALL_ORDER_05', '查询订单状态', 'SUCCESS', 'https://mall.example.com/api/order/detail?orderId=ORD20260801001', 'GET', '{"Authorization":"Bearer mock-token-1"}', NULL, 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"status":"PAID"}}', 2100, NULL, NULL, '2026-08-13 09:30:11', '2026-08-13 09:30:12', '2026-08-13 09:30:11', NULL, 5),
(6, 'EXEC_2026081302', 'NODE_MALL_LOGIN_01', '账号密码登录', 'SUCCESS', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', '{"username":"user_tester","password":"***"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"token":"mock-token-2"}}', 2000, NULL, '{"token":"mock-token-2"}', '2026-08-13 09:45:00', '2026-08-13 09:45:02', '2026-08-13 09:45:00', NULL, 1),
(7, 'EXEC_2026081302', 'NODE_MALL_LOGIN_02', '获取用户信息', 'SUCCESS', 'https://mall.example.com/api/user/profile', 'GET', '{"Authorization":"Bearer mock-token-2"}', NULL, 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"nickname":"测试用户"}}', 1600, NULL, NULL, '2026-08-13 09:45:03', '2026-08-13 09:45:05', '2026-08-13 09:45:03', NULL, 2),
(8, 'EXEC_2026081302', 'NODE_MALL_LOGIN_03', '校验令牌有效性', 'SUCCESS', 'https://mall.example.com/api/auth/check', 'POST', '{"Content-Type":"application/json"}', '{"token":"mock-token-2"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"valid":true}}', 1200, NULL, NULL, '2026-08-13 09:45:06', '2026-08-13 09:45:08', '2026-08-13 09:45:06', NULL, 3),
(9, 'EXEC_2026081303', 'NODE_ORDER_QUERY_01', '登录获取令牌', 'SUCCESS', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', '{"username":"order_admin","password":"***"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"token":"mock-token-3"}}', 2100, NULL, '{"token":"mock-token-3"}', '2026-08-13 10:00:00', '2026-08-13 10:00:02', '2026-08-13 10:00:00', NULL, 1),
(10, 'EXEC_2026081303', 'NODE_ORDER_QUERY_02', '分页查询订单', 'SUCCESS', 'https://mall.example.com/api/order/list?pageNo=1&pageSize=20&status=PAID', 'GET', '{"Authorization":"Bearer mock-token-3"}', NULL, 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"total":42}}', 1800, NULL, NULL, '2026-08-13 10:00:03', '2026-08-13 10:00:06', '2026-08-13 10:00:03', NULL, 2),
(11, 'EXEC_2026081401', 'NODE_REFUND_01', '发起退款', 'SUCCESS', 'https://mall.example.com/api/refund/apply', 'POST', '{"Content-Type":"application/json"}', '{"orderId":"ORD20260801001","reason":"用户申请退款"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"refundId":"RF20260814001"}}', 3000, NULL, '{"refundId":"RF20260814001"}', '2026-08-14 08:00:00', '2026-08-14 08:00:03', '2026-08-14 08:00:00', NULL, 1),
(12, 'EXEC_2026081401', 'NODE_REFUND_02', '风控审核', 'SUCCESS', 'https://mall.example.com/api/refund/audit', 'POST', '{"Content-Type":"application/json"}', '{"refundId":"RF20260814001","result":"PASS"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"audit":"PASS"}}', 2400, NULL, NULL, '2026-08-14 08:00:04', '2026-08-14 08:00:06', '2026-08-14 08:00:04', NULL, 2),
(13, 'EXEC_2026081401', 'NODE_REFUND_03', '退款回调', 'FAILED', 'https://pay.example.com/api/refund/callback', 'POST', '{"Content-Type":"application/json"}', '{"refundId":"RF20260814001","status":"SUCCESS"}', 500, '{"Content-Type":"application/json"}', '{"code":500,"message":"internal error"}', 3800, '断言失败: 响应码=500', NULL, '2026-08-14 08:00:07', '2026-08-14 08:00:15', '2026-08-14 08:00:07', NULL, 3),
(14, 'EXEC_2026081402', 'NODE_GOODS_PUBLISH_01', '登录获取令牌', 'SUCCESS', 'https://mall.example.com/api/login', 'POST', '{"Content-Type":"application/json"}', '{"username":"goods_tester","password":"***"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"token":"mock-token-4"}}', 2000, NULL, '{"token":"mock-token-4"}', '2026-08-14 08:30:00', '2026-08-14 08:30:02', '2026-08-14 08:30:00', NULL, 1),
(15, 'EXEC_2026081402', 'NODE_GOODS_PUBLISH_02', '创建商品', 'SUCCESS', 'https://mall.example.com/api/goods/create', 'POST', '{"Content-Type":"application/json"}', '{"name":"测试商品","price":199,"stock":100}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"goodsId":"G20260814001"}}', 2600, NULL, '{"goodsId":"G20260814001"}', '2026-08-14 08:30:03', '2026-08-14 08:30:06', '2026-08-14 08:30:03', NULL, 2),
(16, 'EXEC_2026081402', 'NODE_GOODS_PUBLISH_03', '商品上架', 'SUCCESS', 'https://mall.example.com/api/goods/publish', 'POST', '{"Content-Type":"application/json"}', '{"goodsId":"G20260814001","action":"ON_SHELF"}', 200, '{"Content-Type":"application/json"}', '{"code":0,"data":{"status":"ON_SHELF"}}', 1800, NULL, NULL, '2026-08-14 08:30:07', '2026-08-14 08:30:09', '2026-08-14 08:30:07', NULL, 3);

-- -------------------------------------------
-- 定时任务
-- -------------------------------------------
INSERT INTO `sys_scheduled_task` (`id`, `task_name`, `task_type`, `chain_code`, `category_id`, `cron_expression`, `interval_minutes`, `round_count`, `round_interval_ms`, `use_data_pool`, `data_pool_code`, `enabled`, `last_run_time`, `next_run_time`, `tenant_id`, `create_time`, `update_time`) VALUES
(1, '电商核心每日回归', 'SINGLE', 'CHAIN_MALL_ORDER', NULL, '0 0 2 * * ?', NULL, 1, 0, 1, 'POOL_ORDER', 1, '2026-08-14 02:00:00', '2026-08-15 02:00:00', 1, '2026-08-05 10:00:00', '2026-08-14 02:00:00'),
(2, '登录链路每小时冒烟', 'SINGLE', 'CHAIN_MALL_LOGIN', NULL, '0 0 * * * ?', NULL, 1, 0, 0, NULL, 1, '2026-08-14 08:00:00', '2026-08-14 09:00:00', 1, '2026-08-06 10:00:00', '2026-08-14 08:00:00'),
(3, '下单分类按半小时回归', 'CATEGORY', NULL, 11, NULL, 30, 1, 0, 0, NULL, 0, NULL, NULL, 1, '2026-08-07 10:00:00', '2026-08-07 10:00:00');

-- -------------------------------------------
-- 定时任务执行日志
-- -------------------------------------------
INSERT INTO `sys_task_execute_log` (`id`, `task_id`, `execution_ids`, `status`, `trigger_type`, `start_time`, `end_time`, `error_message`, `round_number`, `total_rounds`, `create_time`) VALUES
(1, 1, 'EXEC_2026081301', 'SUCCESS', 'SCHEDULED', '2026-08-13 02:00:00', '2026-08-13 02:00:12', NULL, 1, 1, '2026-08-13 02:00:00'),
(2, 2, 'EXEC_2026081302', 'SUCCESS', 'SCHEDULED', '2026-08-13 08:00:00', '2026-08-13 08:00:08', NULL, 1, 1, '2026-08-13 08:00:00'),
(3, 1, 'EXEC_2026081401', 'FAILED', 'SCHEDULED', '2026-08-14 02:00:00', '2026-08-14 02:00:15', '断言失败: 节点[退款回调] 响应码=500', 1, 1, '2026-08-14 02:00:00');

-- -------------------------------------------
-- 用户（密码均为 Admin@123，BCrypt 加密）
-- -------------------------------------------
INSERT INTO `sys_user` (`id`, `username`, `password`, `display_name`, `role`, `tenant_id`, `status`, `last_login_time`, `create_time`, `update_time`) VALUES
(1, 'admin', '$2a$10$gmCiTTTMLVnMotdNYfbIOOH4TM4Vuqj42QBaLsWFNm4pseixi.VB2', '系统管理员', 'ADMIN', 1, 1, '2026-08-14 09:00:00', '2026-08-01 09:00:00', '2026-08-14 09:00:00'),
(2, 'zhangsan', '$2a$10$gmCiTTTMLVnMotdNYfbIOOH4TM4Vuqj42QBaLsWFNm4pseixi.VB2', '张伟', 'USER', 1, 1, '2026-08-13 18:00:00', '2026-08-05 10:00:00', '2026-08-13 18:00:00'),
(3, 'lisi', '$2a$10$gmCiTTTMLVnMotdNYfbIOOH4TM4Vuqj42QBaLsWFNm4pseixi.VB2', '李娜', 'USER', 2, 1, NULL, '2026-08-06 10:00:00', '2026-08-06 10:00:00');

-- -------------------------------------------
-- SSO 用户映射（演示数据；sso.* 默认关闭时不影响登录）
-- -------------------------------------------
INSERT INTO `sys_user_sso` (`id`, `user_id`, `sso_provider`, `sso_subject`, `create_time`) VALUES
(1, 1, 'wecom', 'admin@corp.example.com', '2026-08-01 10:00:00'),
(2, 2, 'dingtalk', 'zhangsan_dingtalk', '2026-08-05 10:00:00');

